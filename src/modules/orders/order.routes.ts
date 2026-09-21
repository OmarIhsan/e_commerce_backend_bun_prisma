import { Elysia, t } from 'elysia';
import { authPlugin, requireAuth, requireAdmin } from '../../common/middleware/auth';
import { sensitiveEndpointRateLimit } from '../../common/middleware/security';
import { prisma } from '../../db/prisma';
import { OrderService } from './order.service';
import {
  CheckoutPayloadSchema,
  CheckoutResponseSchema,
} from './order.model';

const orderService = new OrderService(prisma);

export const orderRoutes = new Elysia({ prefix: '/api/v1/orders' })
  .use(authPlugin)

  /**
   * GET /api/v1/orders
   * Retrieves order list with filtering, search, and pagination.
   * Admins can view all orders; customers only their own.
   */
  .get(
    '/',
    async ({ user, query }) => {
      const isAdmin = user!.role === 'ADMIN';
      const result = await orderService.listOrders(query, user!.id, isAdmin);
      return {
        success: true,
        ...result,
      };
    },
    {
      beforeHandle: [requireAuth],
      query: t.Object({
        status: t.Optional(t.String()),
        paymentStatus: t.Optional(t.String()),
        search: t.Optional(t.String()),
        page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
        limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 100 })),
      }),
      detail: {
        tags: ['Orders'],
        summary: 'List orders (filtered by owner unless Admin)',
        security: [{ bearerAuth: [] }],
      },
    }
  )

  /**
   * POST /api/v1/orders/checkout
   * Executes atomic checkout with pessimistic inventory locking
   * Protected with authentication and strict anti-bot rate limiting
   */
  .post(
    '/checkout',
    async ({ user, body, set }) => {
      // User is verified non-null by requireAuth guard
      const result = await orderService.checkout(user!.id, body);

      set.status = 201;
      return {
        success: true,
        message: 'Order placed successfully',
        data: result,
      };
    },
    {
      beforeHandle: [sensitiveEndpointRateLimit, requireAuth],
      body: CheckoutPayloadSchema,
      response: {
        201: CheckoutResponseSchema,
      },
      detail: {
        tags: ['Orders'],
        summary: 'Atomic order checkout transaction',
        description:
          'Validates stock, locks product inventory rows, decrements quantities, and creates an order atomically within a single database transaction. Rate limited to prevent bot abuse.',
        security: [{ bearerAuth: [] }],
      },
    }
  )

  /**
   * GET /api/v1/orders/:id
   * Retrieves order details with access control verification
   */
  .get(
    '/:id',
    async ({ user, params }) => {
      const order = await orderService.getOrderById(
        params.id,
        user!.id,
        user!.role === 'ADMIN'
      );

      return {
        success: true,
        data: order,
      };
    },
    {
      beforeHandle: [requireAuth],
      params: t.Object({
        id: t.String({ format: 'uuid', description: 'Order UUID' }),
      }),
      detail: {
        tags: ['Orders'],
        summary: 'Retrieve order by ID',
        description:
          'Fetches details of a specific order for the authenticated owner or admin.',
        security: [{ bearerAuth: [] }],
      },
    }
  )

  /**
   * PATCH /api/v1/orders/:id/status
   * Updates fulfillment or payment status (Admin only)
   */
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      const updated = await orderService.updateOrderStatus(
        params.id,
        body.status,
        body.paymentStatus
      );

      return {
        success: true,
        message: 'Order status updated successfully',
        data: updated,
        order: updated,
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      params: t.Object({
        id: t.String({ format: 'uuid', description: 'Order UUID' }),
      }),
      body: t.Object({
        status: t.Optional(t.String()),
        paymentStatus: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Orders'],
        summary: 'Update order fulfillment or payment status (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  );
