// Strict typed environment variable extraction using native Bun.env

export const env = {
  PORT: Number(Bun.env.PORT ?? 3000),
  NODE_ENV: Bun.env.NODE_ENV ?? 'development',
  DATABASE_URL:
    Bun.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/ecommerce_db?schema=public&connection_limit=10&pool_timeout=10',
  JWT_SECRET:
    Bun.env.JWT_SECRET ??
    'super_secret_jwt_key_for_bun_ecommerce_2026_production_ready',
  JWT_EXPIRES_IN: Bun.env.JWT_EXPIRES_IN ?? '7d',
  CORS_ORIGIN: Bun.env.CORS_ORIGIN ?? '*',
};

if (!Bun.env.JWT_SECRET && env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
}

if (!Bun.env.DATABASE_URL && env.NODE_ENV === 'production') {
  throw new Error('FATAL: DATABASE_URL environment variable must be set in production');
}
