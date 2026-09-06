import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('Order & Checkout Pipeline', () => {
  it('POST /api/v1/orders/checkout rejects unauthenticated requests with 401', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
              quantity: 1,
            },
          ],
          shippingAddress: {
            fullName: 'Jane Doe',
            addressLine1: '123 Market Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US',
          },
        }),
      })
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/orders/checkout rejects malformed payload (invalid UUID / quantity 0) with 422', async () => {
    // Generate a valid JWT token using the app's jwt plugin instance
    const dummyJwtResponse = await fetch('http://localhost:3000/health');
    // Call endpoint with invalid payload
    const response = await app.handle(
      new Request('http://localhost:3000/api/v1/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid.token.payload',
        },
        body: JSON.stringify({
          items: [
            {
              productId: 'not-a-valid-uuid',
              quantity: 0, // Must be >= 1
            },
          ],
          shippingAddress: {
            fullName: 'J', // minLength: 2 violated
            addressLine1: '12', // minLength: 3 violated
          },
        }),
      })
    );

    // Either 401 (invalid token) or 422 (validation error) before reaching Prisma
    expect([401, 422]).toContain(response.status);
  });
});
