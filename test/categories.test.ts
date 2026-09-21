import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('Categories & Taxonomy REST Engine', () => {
  it('POST /api/v1/categories rejects unauthenticated requests with 401', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Audio Gear',
          slug: 'audio-gear',
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('PATCH /api/v1/categories/:id rejects unauthenticated requests with 401', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost:3000/api/v1/categories/00000000-0000-0000-0000-000000000000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Updated Gear',
          }),
        }
      )
    );

    expect(response.status).toBe(401);
  });

  it('DELETE /api/v1/categories/:id rejects unauthenticated requests with 401', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost:3000/api/v1/categories/00000000-0000-0000-0000-000000000000',
        {
          method: 'DELETE',
        }
      )
    );

    expect(response.status).toBe(401);
  });
});
