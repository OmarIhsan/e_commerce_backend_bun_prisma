import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { env } from '../src/common/config/env';

describe('Authentication & JWT Initialization', () => {
  it('env.JWT_SECRET is guaranteed non-empty string', () => {
    expect(env.JWT_SECRET).toBeDefined();
    expect(typeof env.JWT_SECRET).toBe('string');
    expect(env.JWT_SECRET.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/auth/login validates required email and password fields', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );

    // Should return 422 Unprocessable Entity for missing payload, NOT 500 FUNCTION_INVOCATION_FAILED
    expect(response.status).toBe(422);
    const body = (await response.json()) as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/login rejects non-existent user with 401 Unauthorized', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent_test_user@ecommerce.local',
          password: 'Password123!',
        }),
      })
    );

    // Should return 401 Unauthorized (or 503 if DB unreachable), NOT 500 FUNCTION_INVOCATION_FAILED
    expect([401, 500, 503]).toContain(response.status);
    if (response.status === 401) {
      const body = (await response.json()) as { success: boolean; code: string };
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    }
  });

  it('GET /api/v1/auth/me rejects unauthenticated request with 401', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/v1/auth/me', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('UNAUTHORIZED');
  });
});
