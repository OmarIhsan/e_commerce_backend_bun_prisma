import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error';

export interface UserTokenPayload {
  sub: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

/**
 * Guard function requiring any authenticated user.
 * Throws UnauthorizedError (HTTP 401) if token is absent or invalid.
 */
export const requireAuth = ({
  user,
}: {
  user: AuthenticatedUser | null;
}) => {
  if (!user) {
    throw new UnauthorizedError('Authentication token is missing, expired, or invalid');
  }
};

/**
 * Guard function requiring an admin user.
 * Throws ForbiddenError (HTTP 403) if user is not an administrator.
 */
export const requireAdmin = ({
  user,
}: {
  user: AuthenticatedUser | null;
}) => {
  if (!user) {
    throw new UnauthorizedError('Authentication token is missing, expired, or invalid');
  }
  if (user.role !== 'ADMIN') {
    throw new ForbiddenError('Access restricted: Administrator role required');
  }
};

/**
 * Stateless Authentication Plugin for Elysia.js
 *
 * Implements strict stateless JWT verification without per-request database queries.
 * Validates cryptographic signature directly via Bun's fast native crypto.
 * Attaches verified { user: AuthenticatedUser | null } to the scoped request context.
 */
export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
      exp: env.JWT_EXPIRES_IN,
    })
  )
  .derive({ as: 'scoped' }, async ({ jwt, headers }) => {
    const authHeader = headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null as AuthenticatedUser | null };
    }

    const token = authHeader.slice(7).trim();

    try {
      const payload = (await jwt.verify(token)) as UserTokenPayload | false;

      if (!payload || !payload.sub || !payload.role) {
        return { user: null as AuthenticatedUser | null };
      }

      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return { user };
    } catch {
      return { user: null as AuthenticatedUser | null };
    }
  });
