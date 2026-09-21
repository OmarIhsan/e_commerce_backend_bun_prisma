import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { prisma } from './db/prisma';
import { env } from './common/config/env';
import { AppError } from './common/errors/app-error';
import { securityHeadersPlugin } from './common/middleware/security';
import { orderRoutes } from './modules/orders/order.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { productRoutes } from './modules/products/product.routes';
import { categoryRoutes } from './modules/categories/category.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { userRoutes } from './modules/users/user.routes';
import { bootstrapDatabase } from './db/bootstrap';

// ============================================================================
// Dynamic Multi-Origin CORS Configuration & Preflight Interceptor
// ============================================================================

const ALLOWED_ORIGINS = new Set<string>([
  'https://e-commerce-admin-next-beta.vercel.app',
  'https://e-commerce-frontend-next-ashy.vercel.app',
]);

const DEV_ORIGINS = new Set<string>([
  'http://localhost:3000',
  'http://localhost:3001',
]);

// Dynamically ingest custom CORS origins defined in environment variables
if (env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
  env.CORS_ORIGIN.split(',').forEach((origin) => {
    const trimmed = origin.trim();
    if (trimmed) ALLOWED_ORIGINS.add(trimmed);
  });
}

/**
 * Validates whether the incoming Origin header is permitted.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (env.NODE_ENV !== 'production' && DEV_ORIGINS.has(origin)) return true;
  return false;
}

/**
 * Builds standard CORS headers for allowed origins.
 */
export function buildCorsHeaders(
  origin: string | null,
  requestedHeaders?: string | null
): Headers {
  const headers = new Headers();
  if (origin && isOriginAllowed(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
    headers.set(
      'Access-Control-Allow-Headers',
      requestedHeaders ||
        'Content-Type, Authorization, Accept, Origin, X-Requested-With'
    );
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

// ============================================================================
// Elysia Application Routing Engine
// ============================================================================

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
  .use(authRoutes)
  .use(orderRoutes)
  .use(productRoutes)
  .use(categoryRoutes)
  .use(analyticsRoutes)
  .use(userRoutes);

// ============================================================================
// Native Bun HTTP Server Dispatcher
// ============================================================================

/**
 * Request handler wrapping Elysia routing with native preflight and dynamic CORS injection
 */
export async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const allowed = isOriginAllowed(origin);

  // 1. Intercept all OPTIONS preflight requests immediately
  if (req.method === 'OPTIONS') {
    const acrh = req.headers.get('access-control-request-headers');
    const preflightHeaders = buildCorsHeaders(origin, acrh);
    return new Response(null, {
      status: 204,
      headers: preflightHeaders,
    });
  }

  // 2. Delegate regular requests to the Elysia routing engine
  const response = await app.fetch(req);

  // 3. Inject CORS headers on standard API responses
  if (allowed && origin) {
    try {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    } catch {
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Vary', 'Origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  }

  return response;
}

// Self-provision database on startup if enabled, not in test suite, and not in Vercel serverless functions
if (
  process.env.NODE_ENV !== 'test' &&
  !process.env.VERCEL &&
  env.AUTO_BOOTSTRAP_DB
) {
  try {
    await bootstrapDatabase();
  } catch (error) {
    console.error('Failed to auto-bootstrap database on startup:', error);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Start HTTP Listener via native Bun.serve() when running in standalone server mode (not in test or Vercel serverless)
export const server =
  process.env.NODE_ENV !== 'test' && !process.env.VERCEL
    ? Bun.serve({
        port: env.PORT,
        fetch: handleRequest,
      })
    : undefined;

if (server) {
  console.log(
    `🚀 E-Commerce API running at http://${server.hostname}:${server.port}`
  );
  console.log(
    `📚 Swagger documentation available at http://${server.hostname}:${server.port}/docs`
  );
}

// Default export for Vercel Serverless Function & Edge Runtime integration
export default app;
