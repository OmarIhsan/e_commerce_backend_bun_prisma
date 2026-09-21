import { Elysia, t } from 'elysia';
import { authPlugin, requireAuth, requireAdmin } from '../../common/middleware/auth';
import { prisma } from '../../db/prisma';
import { ProductService } from './product.service';
import { productCache } from './product.cache';
import {
  ProductQuerySchema,
  CreateProductPayloadSchema,
  UpdateProductPayloadSchema,
} from './product.model';

const productService = new ProductService(prisma);

export const productRoutes = new Elysia({ prefix: '/api/v1/products' })
  .use(authPlugin)

  /**
   * GET /api/v1/products
   * Read-through cached product catalog listing with search, category filtering, and sorting
   */
  .get(
    '/',
    async ({ query }) => {
      const cacheKey = productCache.generateKey(query as Record<string, unknown>);
      const cached = productCache.get<{
        products: any[];
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(cacheKey);

      if (cached) {
        return {
          success: true,
          source: 'cache',
          ...cached,
        };
      }

      const result = await productService.listProducts(query);
      productCache.set(cacheKey, result);

      return {
        success: true,
        source: 'database',
        ...result,
      };
    },
    {
      query: ProductQuerySchema,
      detail: {
        tags: ['Products'],
        summary: 'List products with filters and pagination',
      },
    }
  )

  /**
   * GET /api/v1/products/:id
   * Fetch single product by UUID or slug
   */
  .get(
    '/:id',
    async ({ params }) => {
      const product = await productService.getProductByIdOrSlug(params.id);
      return {
        success: true,
        data: product,
        product,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Products'],
        summary: 'Retrieve single product by ID or slug',
      },
    }
  )

  /**
   * POST /api/v1/products
   * Create new product (Protected: ADMIN only)
   */
  .post(
    '/',
    async ({ user, body, set }) => {
      const product = await productService.createProduct(body);
      set.status = 201;
      return {
        success: true,
        message: 'Product created successfully',
        data: product,
        product,
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      body: CreateProductPayloadSchema,
      detail: {
        tags: ['Products'],
        summary: 'Create product (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  )

  /**
   * PATCH /api/v1/products/:id
   * Update existing product or inventory levels (Protected: ADMIN only)
   */
  .patch(
    '/:id',
    async ({ user, params, body }) => {
      const product = await productService.updateProduct(params.id, body);
      return {
        success: true,
        message: 'Product updated successfully',
        data: product,
        product,
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: UpdateProductPayloadSchema,
      detail: {
        tags: ['Products'],
        summary: 'Update product (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  )

  /**
   * DELETE /api/v1/products/:id
   * Delete or archive product (Protected: ADMIN only)
   */
  .delete(
    '/:id',
    async ({ user, params }) => {
      const result = await productService.deleteProduct(params.id);
      return {
        success: true,
        ...result,
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      detail: {
        tags: ['Products'],
        summary: 'Delete or archive product (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  );
