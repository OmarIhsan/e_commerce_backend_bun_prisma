import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { prisma } from '../../db/prisma';
import { env } from '../../common/config/env';
import { authPlugin, requireAuth } from '../../common/middleware/auth';
import { UnauthorizedError, ConflictError } from '../../common/errors/app-error';

const jwtSecret =
  env.JWT_SECRET && env.JWT_SECRET.trim() !== ''
    ? env.JWT_SECRET.trim()
    : 'super_secret_jwt_key_for_bun_ecommerce_2026_production_ready';

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: jwtSecret,
      exp: env.JWT_EXPIRES_IN || '7d',
    })
  )
  .use(authPlugin)
  /**
   * POST /api/v1/auth/login
   * Authenticates credentials and returns JWT bearer token
   */
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      const { email, password } = body;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isValidPassword = await Bun.password.verify(
        password,
        user.passwordHash
      );

      if (!isValidPassword) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const token = await jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      set.status = 200;
      return {
        success: true,
        message: 'Authentication successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email', description: 'User account email' }),
        password: t.String({ minLength: 6, description: 'User account password' }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Authenticate user and obtain JWT token',
        description: 'Validates user credentials and issues a signed JWT token.',
      },
    }
  )
  /**
   * POST /api/v1/auth/register
   * Creates a new customer account and issues JWT
   */
  .post(
    '/register',
    async ({ body, jwt, set }) => {
      const { email, password, name } = body;

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      const passwordHash = await Bun.password.hash(password, {
        algorithm: 'bcrypt',
        cost: 10,
      });

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          role: 'CUSTOMER',
        },
      });

      const token = await jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      set.status = 201;
      return {
        success: true,
        message: 'User registered successfully',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email', description: 'Valid email address' }),
        password: t.String({ minLength: 6, description: 'Password (min 6 characters)' }),
        name: t.String({ minLength: 2, description: 'Customer full name' }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Register a new customer account',
        description: 'Registers a customer and automatically returns an authenticated JWT session.',
      },
    }
  )
  /**
   * GET /api/v1/auth/me
   * Returns current authenticated user context
   */
  .get(
    '/me',
    async ({ user }) => {
      return {
        success: true,
        data: user,
      };
    },
    {
      beforeHandle: [requireAuth],
      detail: {
        tags: ['Auth'],
        summary: 'Get current authenticated user profile',
        security: [{ bearerAuth: [] }],
      },
    }
  );
