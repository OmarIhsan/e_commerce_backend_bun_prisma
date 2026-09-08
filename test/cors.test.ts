import { describe, expect, it } from 'bun:test';
import { handleRequest, isOriginAllowed } from '../src/index';

describe('Dynamic Multi-Origin CORS & Preflight Subsystem', () => {
  const allowedAdmin = 'https://e-commerce-admin-next-beta.vercel.app';
  const allowedFrontend = 'https://e-commerce-frontend-next-ashy.vercel.app';
  const allowedLocal = 'http://localhost:3001';
  const unauthorizedOrigin = 'https://malicious-site.com';

  it('correctly evaluates allowed and unauthorized origins', () => {
    expect(isOriginAllowed(allowedAdmin)).toBe(true);
    expect(isOriginAllowed(allowedFrontend)).toBe(true);
    expect(isOriginAllowed(allowedLocal)).toBe(true);
    expect(isOriginAllowed(unauthorizedOrigin)).toBe(false);
    expect(isOriginAllowed(null)).toBe(false);
  });

  it('intercepts OPTIONS preflight and returns 204 No Content with CORS headers for Admin Vercel origin', async () => {
    const req = new Request('http://localhost:3000/api/v1/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: allowedAdmin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    const res = await handleRequest(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(allowedAdmin);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('intercepts OPTIONS preflight for Frontend Vercel origin', async () => {
    const req = new Request('http://localhost:3000/api/v1/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: allowedFrontend,
      },
    });

    const res = await handleRequest(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(allowedFrontend);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('rejects CORS headers for unauthorized origin on OPTIONS preflight', async () => {
    const req = new Request('http://localhost:3000/api/v1/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: unauthorizedOrigin,
      },
    });

    const res = await handleRequest(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('injects CORS headers into regular GET/POST responses for allowed origins', async () => {
    const req = new Request('http://localhost:3000/docs', {
      method: 'GET',
      headers: {
        Origin: allowedFrontend,
      },
    });

    const res = await handleRequest(req);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(allowedFrontend);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Vary')).toBe('Origin');
  });
});
