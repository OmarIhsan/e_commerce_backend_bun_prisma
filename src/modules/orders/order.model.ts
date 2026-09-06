import { t, type Static } from 'elysia';

// TypeBox Schema Definitions for Order & Checkout Operations

export const ShippingAddressSchema = t.Object(
  {
    fullName: t.String({
      minLength: 2,
      maxLength: 100,
      description: 'Recipient full legal name',
    }),
    addressLine1: t.String({
      minLength: 3,
      maxLength: 200,
      description: 'Street address or P.O. Box',
    }),
    addressLine2: t.Optional(
      t.String({
        maxLength: 200,
        description: 'Apartment, suite, unit, or building',
      })
    ),
    city: t.String({ minLength: 2, maxLength: 100 }),
    state: t.String({ minLength: 2, maxLength: 100 }),
    postalCode: t.String({ minLength: 2, maxLength: 20 }),
    country: t.String({ minLength: 2, maxLength: 60, default: 'US' }),
  },
  { description: 'Shipping destination address details' }
);

export const CheckoutItemSchema = t.Object({
  productId: t.String({
    format: 'uuid',
    description: 'Product identifier (UUID v4)',
  }),
  quantity: t.Integer({
    minimum: 1,
    maximum: 1000,
    description: 'Units to purchase (must be greater than 0)',
  }),
});

export const CheckoutPayloadSchema = t.Object(
  {
    items: t.Array(CheckoutItemSchema, {
      minItems: 1,
      maxItems: 50,
      description: 'List of order line items to purchase',
    }),
    shippingAddress: ShippingAddressSchema,
  },
  { description: 'Atomic checkout mutation request payload' }
);

export type ShippingAddress = Static<typeof ShippingAddressSchema>;
export type CheckoutItem = Static<typeof CheckoutItemSchema>;
export type CheckoutPayload = Static<typeof CheckoutPayloadSchema>;

export const CheckoutResponseSchema = t.Object({
  success: t.Boolean(),
  message: t.String(),
  data: t.Object({
    orderId: t.String(),
    orderNumber: t.String(),
    status: t.String(),
    paymentStatus: t.String(),
    totalAmount: t.String(),
    itemCount: t.Integer(),
    createdAt: t.String(),
  }),
});
