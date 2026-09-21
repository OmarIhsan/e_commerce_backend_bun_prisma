import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('Products & Catalog REST Engine', () => {
  it('POST /api/v1/products rejects unauthenticated requests with 401', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Mechanical Keyboard',
          sku: 'TEST-KB-99',
          price: 99.99,
          stock: 10,
          categoryId: '00000000-0000-0000-0000-000000000000',
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('PATCH /api/v1/products/:id rejects unauthenticated requests with 401', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost:3000/api/v1/products/00000000-0000-0000-0000-000000000000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            price: 120.0,
          }),
        }
      )
    );

    expect(response.status).toBe(401);
  });

  it('DELETE /api/v1/products/:id rejects unauthenticated requests with 401', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost:3000/api/v1/products/00000000-0000-0000-0000-000000000000',
        {
          method: 'DELETE',
        }
      )
    );

    expect(response.status).toBe(401);
  });
});
