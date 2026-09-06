import { Prisma, type PrismaClient } from '@prisma/client';
import {
  InsufficientStockError,
  NotFoundError,
  AppError,
} from '../../common/errors/app-error';
import type { CheckoutPayload } from './order.model';

export class OrderService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generates a unique, collision-resistant, human-readable order tracking number.
   * Format: ORD-YYYYMMDD-[RANDOM_ALPHANUMERIC]
   */
  private generateOrderNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
  }

  /**
   * Executes an atomic checkout transaction.
   *
   * High-Concurrency Guarantees:
   * 1. Acquires row-level pessimistic locks (SELECT FOR UPDATE) within a Prisma Interactive Transaction.
   * 2. Strictly validates that product stock >= requested quantity before any mutation.
   * 3. Atomically decrements product inventory.
   * 4. Calculates precise line-item subtotals and order total using Decimal arithmetic.
   * 5. Atomically generates the Order and cascading OrderItem records.
   * 6. Automatically rolls back all operations if any stock is insufficient or a constraint fails.
   */
  async checkout(userId: string, payload: CheckoutPayload) {
    const { items, shippingAddress } = payload;

    // Consolidate duplicate product IDs in the checkout cart
    const itemMap = new Map<string, number>();
    for (const item of items) {
      const current = itemMap.get(item.productId) ?? 0;
      itemMap.set(item.productId, current + item.quantity);
    }

    const uniqueProductIds = Array.from(itemMap.keys());

    return this.prisma.$transaction(
      async (tx) => {
        // Step 1: Pessimistic Row Lock (SELECT ... FOR UPDATE)
        // Prevents race conditions and dirty reads across high-concurrency checkouts.
        const lockedProducts = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            price: Prisma.Decimal;
            stock: number;
            is_published: boolean;
          }>
        >`
          SELECT id, name, price, stock, is_published
          FROM products
          WHERE id = ANY(${uniqueProductIds}::uuid[])
          FOR UPDATE
        `;

        if (lockedProducts.length !== uniqueProductIds.length) {
          const foundIds = new Set(lockedProducts.map((p) => p.id));
          const missingIds = uniqueProductIds.filter((id) => !foundIds.has(id));
          throw new NotFoundError(
            `Products not found for checkout: ${missingIds.join(', ')}`
          );
        }

        // Map locked product records by ID for O(1) retrieval
        const productCatalog = new Map(
          lockedProducts.map((p) => [p.id, p])
        );

        // Step 2 & 3: Validate availability and inventory limits
        let totalAmount = new Prisma.Decimal(0);
        const orderLineItemsData: Array<{
          productId: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];

        for (const [productId, requestedQuantity] of itemMap.entries()) {
          const product = productCatalog.get(productId)!;

          if (!product.is_published) {
            throw new AppError(
              `Product "${product.name}" is not currently available for purchase`,
              400,
              'PRODUCT_UNAVAILABLE'
            );
          }

          if (product.stock < requestedQuantity) {
            throw new InsufficientStockError(
              productId,
              requestedQuantity,
              product.stock,
              `Insufficient stock for "${product.name}". Requested: ${requestedQuantity}, Available: ${product.stock}`
            );
          }

          // Step 4: Calculate precise currency subtotal using Decimal arithmetic
          const unitPrice = new Prisma.Decimal(product.price);
          const subtotal = unitPrice.mul(requestedQuantity);
          totalAmount = totalAmount.add(subtotal);

          orderLineItemsData.push({
            productId,
            quantity: requestedQuantity,
            unitPrice,
            subtotal,
          });
        }

        // Step 5: Atomically deduct inventory for each line item
        for (const [productId, requestedQuantity] of itemMap.entries()) {
          await tx.product.update({
            where: { id: productId },
            data: {
              stock: {
                decrement: requestedQuantity,
              },
            },
          });
        }

        // Step 6: Create the Order with cascading OrderItems
        const orderNumber = this.generateOrderNumber();

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            totalAmount,
            shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
            items: {
              create: orderLineItemsData.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
              })),
            },
          },
          include: {
            items: true,
          },
        });

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount.toFixed(2),
          itemCount: order.items.length,
          createdAt: order.createdAt.toISOString(),
        };
      },
      {
        maxWait: 5000, // Wait up to 5s to acquire a transaction connection slot
        timeout: 10000, // Timeout transaction after 10s to prevent hanging locks
      }
    );
  }

  /**
   * Retrieves order by ID, ensuring ownership or administrative privilege.
   */
  async getOrderById(orderId: string, requestingUserId: string, isAdmin: boolean) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== requestingUserId && !isAdmin) {
      throw new AppError('Unauthorized access to order', 403, 'FORBIDDEN');
    }

    return order;
  }
}
