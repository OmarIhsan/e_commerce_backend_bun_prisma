import { Elysia, t } from 'elysia';
import { authPlugin, requireAuth, requireAdmin } from '../../common/middleware/auth';
import { prisma } from '../../db/prisma';
import { CategoryService } from './category.service';
import {
  CreateCategoryPayloadSchema,
  UpdateCategoryPayloadSchema,
} from './category.model';

const categoryService = new CategoryService(prisma);

export const categoryRoutes = new Elysia({ prefix: '/api/v1/categories' })
  .use(authPlugin)

  /**
   * GET /api/v1/categories
   * Retrieves category taxonomy tree with associated product counts
   */
  .get(
    '/',
    async () => {
      const result = await categoryService.listCategories();
      return {
        success: true,
        ...result,
      };
    },
    {
      detail: {
        tags: ['Categories'],
        summary: 'List all categories with product counts',
      },
    }
  )

  /**
   * GET /api/v1/categories/:id
   * Fetch category by UUID or slug
   */
  .get(
    '/:id',
    async ({ params }) => {
      const category = await categoryService.getCategoryByIdOrSlug(params.id);
      return {
        success: true,
        data: category,
        category,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Categories'],
        summary: 'Retrieve category by ID or slug',
      },
    }
  )

  /**
   * POST /api/v1/categories
   * Create new category (Protected: ADMIN only)
   */
  .post(
    '/',
    async ({ user, body, set }) => {
      const category = await categoryService.createCategory(body);
      set.status = 201;
      return {
        success: true,
        message: 'Category created successfully',
        data: category,
        category,
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      body: CreateCategoryPayloadSchema,
      detail: {
        tags: ['Categories'],
        summary: 'Create category (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  )

  /**
   * PATCH /api/v1/categories/:id
   * Update category (Protected: ADMIN only)
   */
  .patch(
    '/:id',
    async ({ user, params, body }) => {
      const category = await categoryService.updateCategory(params.id, body);
      return {
        success: true,
        message: 'Category updated successfully',
        data: category,
        category,
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: UpdateCategoryPayloadSchema,
      detail: {
        tags: ['Categories'],
        summary: 'Update category (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  )

  /**
   * DELETE /api/v1/categories/:id
   * Delete category (Protected: ADMIN only)
   */
  .delete(
    '/:id',
    async ({ user, params }) => {
      const result = await categoryService.deleteCategory(params.id);
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
        tags: ['Categories'],
        summary: 'Delete category (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  );
