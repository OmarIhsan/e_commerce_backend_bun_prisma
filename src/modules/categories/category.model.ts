import { t } from 'elysia';

export const CreateCategoryPayloadSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  slug: t.Optional(t.String({ minLength: 2, maxLength: 120 })),
  description: t.Optional(t.String()),
  image: t.Optional(t.String({ format: 'uri' })),
});

export const UpdateCategoryPayloadSchema = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  slug: t.Optional(t.String({ minLength: 2, maxLength: 120 })),
  description: t.Optional(t.String()),
  image: t.Optional(t.String()),
});

export type CreateCategoryPayload = typeof CreateCategoryPayloadSchema.static;
export type UpdateCategoryPayload = typeof UpdateCategoryPayloadSchema.static;
