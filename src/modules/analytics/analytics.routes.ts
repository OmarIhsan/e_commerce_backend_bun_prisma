import { Elysia } from 'elysia';
import { authPlugin, requireAuth, requireAdmin } from '../../common/middleware/auth';
import { prisma } from '../../db/prisma';

export const analyticsRoutes = new Elysia({ prefix: '/api/v1/analytics' })
  .use(authPlugin)

  /**
   * GET /api/v1/analytics/overview
   * Computes live KPI metrics from database for admin dashboard
   */
  .get(
    '/overview',
    async () => {
      const [
        revenueAggregate,
        totalOrders,
        activeOrders,
        catalogCount,
        lowStockCount,
        registeredUsers,
        adminCount,
      ] = await Promise.all([
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { paymentStatus: 'PAID' },
        }),
        prisma.order.count(),
        prisma.order.count({
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'],
            },
          },
        }),
        prisma.product.count({ where: { isPublished: true } }),
        prisma.product.count({
          where: { isPublished: true, stock: { lt: 5 } },
        }),
        prisma.user.count(),
        prisma.user.count({ where: { role: 'ADMIN' } }),
      ]);

      const totalRevenue = Number(revenueAggregate._sum.totalAmount || 0);

      return {
        success: true,
        data: {
          totalRevenue,
          totalRevenueFormatted: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(totalRevenue),
          totalOrders,
          activeOrders,
          catalogItems: catalogCount,
          lowStockItems: lowStockCount,
          registeredUsers,
          adminCount,
          timestamp: new Date().toISOString(),
        },
      };
    },
    {
      beforeHandle: [requireAuth, requireAdmin],
      detail: {
        tags: ['Analytics'],
        summary: 'Platform overview KPI statistics (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    }
  );
