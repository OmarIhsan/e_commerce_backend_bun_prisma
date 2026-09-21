import { Elysia, t } from 'elysia';
import { authPlugin, requireAuth, requireAdmin } from '../../common/middleware/auth';
import { prisma } from '../../db/prisma';

export const userRoutes = new Elysia({ prefix: '/api/v1/users' })
  .use(authPlugin)

  /**
   * GET /api/v1/users
   * Lists registered users (Admin only)
   */
  .get(
    '/',
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (query.role) {
        where.role = query.role.toUpperCase();
      }
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { orders: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const formatted = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        orderCount: u._count.orders,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      }));

      return {
        success: true,
        users: formatted,
        data: formatted,
        total,
        page,
        limit,
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      query: t.Object({
        role: t.Optional(t.String()),
        search: t.Optional(t.String()),
        page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
        limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 100 })),
      }),
      detail: {
        tags: ['Users'],
        summary: 'List users (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  );
