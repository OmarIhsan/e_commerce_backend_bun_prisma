import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('System Health & Bootstrapping', () => {
  it('GET /health returns valid JSON with runtime metadata', async () => {
    const response = await app.handle(new Request('http://localhost:3000/health'));
    expect(response.status).toBeOneOf([200, 503]);
    const body = (await response.json()) as {
      status: string;
      runtime: string;
      database: string;
    };
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('runtime');
    expect(body.runtime).toStartWith('Bun');
  });

  it('GET /nonexistent triggers 404 handler', async () => {
    const response = await app.handle(new Request('http://localhost:3000/nonexistent'));
    expect(response.status).toBe(404);
    const body = (await response.json()) as {
      success: boolean;
      code: string;
      message: string;
    };
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');
  });
});
