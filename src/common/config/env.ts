// Strict typed environment variable extraction compatible with both Bun and Node/Vercel

function getEnv(key: string, fallback?: string): string | undefined {
  if (typeof Bun !== 'undefined' && Bun.env && Bun.env[key] !== undefined) {
    return Bun.env[key];
  }
  return process.env[key] ?? fallback;
}

export const env = {
  PORT: Number(getEnv('PORT', '3000')),
  NODE_ENV: getEnv('NODE_ENV', 'development')!,
  DATABASE_URL:
    getEnv('DATABASE_URL') ??
    'postgresql://postgres:postgres@localhost:5432/ecommerce_db?schema=public&connection_limit=10&pool_timeout=10',
  DIRECT_URL:
    getEnv('DIRECT_URL') ??
    getEnv('DATABASE_URL') ??
    'postgresql://postgres:postgres@localhost:5432/ecommerce_db?schema=public',
  AUTO_BOOTSTRAP_DB:
    getEnv('AUTO_BOOTSTRAP_DB') !== undefined
      ? getEnv('AUTO_BOOTSTRAP_DB') === 'true'
      : true,
  JWT_SECRET:
    getEnv('JWT_SECRET') ??
    'super_secret_jwt_key_for_bun_ecommerce_2026_production_ready',
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '7d')!,
  CORS_ORIGIN: getEnv('CORS_ORIGIN', '*')!,
};

if (!getEnv('JWT_SECRET') && env.NODE_ENV === 'production' && !getEnv('VERCEL')) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
}

if (!getEnv('DATABASE_URL') && env.NODE_ENV === 'production' && !getEnv('VERCEL')) {
  throw new Error('FATAL: DATABASE_URL environment variable must be set in production');
}
