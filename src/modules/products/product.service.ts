import { Prisma, type PrismaClient } from '@prisma/client';
import { NotFoundError, AppError } from '../../common/errors/app-error';
import { productCache } from './product.cache';
import type {
  ProductQueryParams,
  CreateProductPayload,
  UpdateProductPayload,
} from './product.model';

export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private formatProduct(p: any) {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      description: p.description,
      price: Number(p.price),
      stock: p.stock,
      isPublished: p.isPublished,
      categoryId: p.categoryId,
      category: p.category ? p.category.name : 'Uncategorized',
      categoryObj: p.category || null,
      images: p.images || [],
      imageUrl: p.images && p.images.length > 0 ? p.images[0].url : null,
      image: p.images && p.images.length > 0 ? p.images[0].url : null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  async listProducts(query: ProductQueryParams = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    } else if (query.category) {
      where.category = {
        OR: [
          { slug: { equals: query.category, mode: 'insensitive' } },
          { name: { equals: query.category, mode: 'insensitive' } },
        ],
      };
    }

    if (query.status === 'published') {
      where.isPublished = true;
    } else if (query.status === 'draft') {
      where.isPublished = false;
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sort === 'price-asc') orderBy = { price: 'asc' };
    else if (query.sort === 'price-desc') orderBy = { price: 'desc' };
    else if (query.sort === 'name-asc') orderBy = { name: 'asc' };
    else if (query.sort === 'stock-asc') orderBy = { stock: 'asc' };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const formatted = products.map((p) => this.formatProduct(p));

    return {
      products: formatted,
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductByIdOrSlug(idOrSlug: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idOrSlug
      );

    const product = await this.prisma.product.findFirst({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundError(`Product not found with identifier "${idOrSlug}"`);
    }

    return this.formatProduct(product);
  }

  async createProduct(payload: CreateProductPayload) {
    const slug = payload.slug || this.slugify(payload.name);

    // Verify category exists
    const categoryExists = await this.prisma.category.findUnique({
      where: { id: payload.categoryId },
    });

    if (!categoryExists) {
      throw new NotFoundError(`Category with ID "${payload.categoryId}" does not exist`);
    }

    // Check slug / SKU uniqueness
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ slug }, { sku: payload.sku }],
      },
    });

    if (existing) {
      if (existing.sku === payload.sku) {
        throw new AppError(`A product with SKU "${payload.sku}" already exists`, 409, 'SKU_CONFLICT');
      }
      throw new AppError(`A product with slug "${slug}" already exists`, 409, 'SLUG_CONFLICT');
    }

    const price = new Prisma.Decimal(payload.price);
    const stock = Math.floor(Number(payload.stock));

    const product = await this.prisma.product.create({
      data: {
        name: payload.name,
        slug,
        sku: payload.sku,
        description: payload.description,
        price,
        stock,
        isPublished: payload.isPublished ?? true,
        categoryId: payload.categoryId,
        images: {
          create: payload.images
            ? payload.images.map((img, idx) => ({
                url: img.url,
                altText: img.altText ?? payload.name,
                isPrimary: img.isPrimary ?? idx === 0,
                sortOrder: idx,
              }))
            : payload.imageUrl
            ? [
                {
                  url: payload.imageUrl,
                  altText: payload.name,
                  isPrimary: true,
                  sortOrder: 0,
                },
              ]
            : [],
        },
      },
      include: {
        category: true,
        images: true,
      },
    });

    // Invalidate product catalog cache
    productCache.invalidateCatalog();

    return this.formatProduct(product);
  }

  async updateProduct(id: string, payload: UpdateProductPayload) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!existing) {
      throw new NotFoundError(`Product with ID "${id}" not found`);
    }

    if (payload.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: payload.categoryId },
      });
      if (!categoryExists) {
        throw new NotFoundError(`Category with ID "${payload.categoryId}" does not exist`);
      }
    }

    if (payload.sku && payload.sku !== existing.sku) {
      const duplicateSku = await this.prisma.product.findUnique({
        where: { sku: payload.sku },
      });
      if (duplicateSku) {
        throw new AppError(`SKU "${payload.sku}" is already assigned to another product`, 409, 'SKU_CONFLICT');
      }
    }

    const data: Prisma.ProductUpdateInput = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.slug !== undefined) data.slug = payload.slug;
    if (payload.sku !== undefined) data.sku = payload.sku;
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.price !== undefined) data.price = new Prisma.Decimal(payload.price);
    if (payload.stock !== undefined) data.stock = Math.floor(Number(payload.stock));
    if (payload.isPublished !== undefined) data.isPublished = payload.isPublished;
    if (payload.categoryId !== undefined) {
      data.category = { connect: { id: payload.categoryId } };
    }

    if (payload.imageUrl) {
      // Upsert primary image
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      await this.prisma.productImage.create({
        data: {
          productId: id,
          url: payload.imageUrl,
          altText: payload.name ?? existing.name,
          isPrimary: true,
          sortOrder: 0,
        },
      });
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        images: true,
      },
    });

    // Targeted cache purge
    productCache.invalidateProduct(id);
    if (existing.slug) productCache.invalidateProduct(existing.slug);

    return this.formatProduct(updated);
  }

  async deleteProduct(id: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Product with ID "${id}" not found`);
    }

    // Check if product is referenced in existing order items
    const orderItemCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      // Soft-delete / unpublish to protect transactional referential integrity
      const unpublished = await this.prisma.product.update({
        where: { id },
        data: { isPublished: false, stock: 0 },
        include: { category: true, images: true },
      });
      productCache.invalidateProduct(id);
      return {
        softDeleted: true,
        message: 'Product archived and removed from catalog due to historic order associations',
        product: this.formatProduct(unpublished),
      };
    }

    await this.prisma.product.delete({
      where: { id },
    });

    productCache.invalidateProduct(id);
    return {
      success: true,
      id,
      message: 'Product deleted permanently',
    };
  }
}
