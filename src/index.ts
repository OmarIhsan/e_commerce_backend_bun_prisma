import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { prisma } from './db/prisma';
import { env } from './common/config/env';
import { AppError } from './common/errors/app-error';
import { securityHeadersPlugin } from './common/middleware/security';
import { orderRoutes } from './modules/orders/order.routes';

// Initialize Elysia application with Bun runtime optimization
export const app = new Elysia()
  // Global Security Headers
  .use(securityHeadersPlugin)

  // Global Prisma decorator for zero-overhead dependency passing
  .decorate('db', prisma)

  // Global Error Handling Middleware
  .onError(({ code, error, set }) => {
    // Custom domain errors (InsufficientStock, RateLimitExceeded, Unauthorized, etc.)
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        success: false,
        code: error.code,
        message: error.message,
      };
    }

    switch (code) {
      case 'VALIDATION':
        set.status = 422;
        return {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: error.all,
        };
      case 'NOT_FOUND':
        set.status = 404;
        return {
          success: false,
          code: 'NOT_FOUND',
          message: 'Resource Not Found',
        };
      case 'PARSE':
        set.status = 400;
        return {
          success: false,
          code: 'BAD_REQUEST',
          message: 'Malformed JSON Payload',
        };
      default:
        console.error('Unhandled Server Error:', error);
        set.status = 500;
        return {
          success: false,
          code: 'INTERNAL_SERVER_ERROR',
          message:
            env.NODE_ENV === 'production'
              ? 'Internal Server Error'
              : (error as Error).message,
        };
    }
  })

  // Global CORS Middleware with strict origin control in production
  .use(
    cors({
      origin:
        env.NODE_ENV === 'production' && env.CORS_ORIGIN !== '*'
          ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
          : true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  )

  // Native Bun JWT Plugin
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
      exp: env.JWT_EXPIRES_IN,
    })
  )

  // OpenAPI / Swagger Documentation
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'High-Performance E-Commerce API',
          version: '1.0.0',
          description:
            'Production-grade e-commerce REST engine powered by Bun.js, Elysia.js, and Prisma ORM',
        },
        tags: [
          { name: 'Auth', description: 'Authentication and token operations' },
          { name: 'Products', description: 'Product catalog and SKU inventory' },
          { name: 'Categories', description: 'Category taxonomy management' },
          { name: 'Orders', description: 'Checkout and atomic transactions' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    })
  )

  // System Health Check
  .get('/health', async ({ db, set }) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        runtime: `Bun ${Bun.version}`,
        database: 'connected',
      };
    } catch {
      set.status = 503;
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        runtime: `Bun ${Bun.version}`,
        database: 'unreachable',
      };
    }
  })

  // Register Feature Domain Routes
  .use(orderRoutes)

  // Start HTTP Listener
  .listen(env.PORT);

console.log(
  `🚀 E-Commerce API running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(
  `📚 Swagger documentation available at http://${app.server?.hostname}:${app.server?.port}/docs`
);
