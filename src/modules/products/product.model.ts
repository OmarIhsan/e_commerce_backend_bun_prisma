import { t } from 'elysia';

export const ProductQuerySchema = t.Object({
  search: t.Optional(t.String()),
  category: t.Optional(t.String()),
  categoryId: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 100 })),
  sort: t.Optional(t.String({ default: 'newest' })),
  status: t.Optional(t.String()),
});

export const CreateProductPayloadSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 200 }),
  slug: t.Optional(t.String({ minLength: 2, maxLength: 250 })),
  sku: t.String({ minLength: 2, maxLength: 100 }),
  description: t.Optional(t.String()),
  price: t.Numeric({ minimum: 0 }),
  stock: t.Numeric({ minimum: 0 }),
  categoryId: t.String({ format: 'uuid' }),
  isPublished: t.Optional(t.Boolean({ default: true })),
  imageUrl: t.Optional(t.String({ format: 'uri' })),
  images: t.Optional(
    t.Array(
      t.Object({
        url: t.String({ format: 'uri' }),
        altText: t.Optional(t.String()),
        isPrimary: t.Optional(t.Boolean()),
      })
    )
  ),
});

export const UpdateProductPayloadSchema = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
  slug: t.Optional(t.String({ minLength: 2, maxLength: 250 })),
  sku: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  description: t.Optional(t.String()),
  price: t.Optional(t.Numeric({ minimum: 0 })),
  stock: t.Optional(t.Numeric({ minimum: 0 })),
  categoryId: t.Optional(t.String({ format: 'uuid' })),
  isPublished: t.Optional(t.Boolean()),
  imageUrl: t.Optional(t.String()),
});

export type ProductQueryParams = typeof ProductQuerySchema.static;
export type CreateProductPayload = typeof CreateProductPayloadSchema.static;
export type UpdateProductPayload = typeof UpdateProductPayloadSchema.static;
