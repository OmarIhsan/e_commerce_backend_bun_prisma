import { Elysia, t } from 'elysia';
import { authPlugin, requireAuth } from '../../common/middleware/auth';
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
  );
