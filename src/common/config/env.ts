// Strict typed environment variable extraction compatible with both Bun and Node/Vercel

const DEFAULT_JWT_SECRET =
  'super_secret_jwt_key_for_bun_ecommerce_2026_production_ready';

function getEnv(key: string, fallback: string = ''): string {
  let val: string | undefined;

  // 1. Check Bun.env if available in runtime
  if (typeof Bun !== 'undefined' && Bun.env && typeof Bun.env[key] === 'string') {
    val = Bun.env[key];
  }

  // 2. Check standard Node/Vercel process.env
  if ((!val || val.trim() === '') && typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    val = process.env[key];
  }

  // 3. Return trimmed value if non-empty, otherwise fallback
  if (val && val.trim() !== '') {
    return val.trim();
  }

  return fallback;
}

// Guarantee JWT_SECRET is never empty string or whitespace under any runtime
const resolvedJwtSecret = getEnv('JWT_SECRET', DEFAULT_JWT_SECRET);
const finalJwtSecret =
  resolvedJwtSecret && resolvedJwtSecret.trim() !== ''
    ? resolvedJwtSecret.trim()
    : DEFAULT_JWT_SECRET;

export const env = {
  PORT: Number(getEnv('PORT', '3000')),
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  DATABASE_URL: getEnv(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/ecommerce_db?schema=public&connection_limit=10&pool_timeout=10'
  ),
  DIRECT_URL: getEnv(
    'DIRECT_URL',
    getEnv(
      'DATABASE_URL',
      'postgresql://postgres:postgres@localhost:5432/ecommerce_db?schema=public'
    )
  ),
  AUTO_BOOTSTRAP_DB: getEnv('AUTO_BOOTSTRAP_DB', 'true') === 'true',
  JWT_SECRET: finalJwtSecret,
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '7d') || '7d',
  CORS_ORIGIN: getEnv('CORS_ORIGIN', '*') || '*',
};

if (!env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET could not be resolved');
}
