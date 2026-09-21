import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { prisma } from './prisma';
import { seedCatalog } from '../../prisma/seed';

export interface BootstrapOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  forceSeed?: boolean;
}

/**
 * Resilient database connectivity ping designed for Neon Serverless compute suspension.
 * Retries with exponential backoff while Neon wakes up from scale-to-zero.
 */
async function waitForDatabaseConnection(
  maxRetries = 5,
  initialBackoffMs = 1000
): Promise<void> {
  console.log('🔄 Checking database connectivity (handling Neon cold starts)...');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`   ✓ Connected to PostgreSQL database (Attempt ${attempt}/${maxRetries})`);
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const backoff = initialBackoffMs * Math.pow(1.5, attempt - 1);
      console.warn(
        `   ⏳ Attempt ${attempt}/${maxRetries} failed: ${
          (error as Error).message
        }. Retrying in ${Math.round(backoff)}ms...`
      );

      if (isLastAttempt) {
        throw new Error(
          `Failed to establish database connection after ${maxRetries} attempts: ${
            (error as Error).message
          }`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Executes Prisma schema deployment or migrations.
 * If prisma/migrations exists, runs `prisma migrate deploy`.
 * If fresh repository without prior migrations, pushes schema via `prisma db push`.
 */
async function runSchemaSynchronization(): Promise<void> {
  const migrationsPath = resolve(process.cwd(), 'prisma/migrations');
  const hasMigrations =
    existsSync(migrationsPath) && readdirSync(migrationsPath).length > 0;

  const command = hasMigrations
    ? ['bun', 'x', 'prisma', 'migrate', 'deploy']
    : ['bun', 'x', 'prisma', 'db', 'push', '--skip-generate'];

  const actionName = hasMigrations ? 'migrate deploy' : 'db push';
  console.log(`🚀 Executing schema synchronization via \`${actionName}\`...`);

  const proc = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
    },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`❌ Schema synchronization failed with exit code ${exitCode}`);
    if (stderr.trim()) console.error(stderr);
    if (stdout.trim()) console.log(stdout);
    throw new Error(`Schema synchronization failed: ${stderr || stdout}`);
  }

  if (stdout.trim()) {
    stdout.split('\n').forEach((line) => {
      if (line.trim()) console.log(`   ${line.trim()}`);
    });
  }
  console.log('   ✓ Schema synchronization completed successfully.');
}

/**
 * Verifies catalog data and executes baseline seeding if the database is unpopulated.
 */
async function ensureBaselineCatalog(forceSeed = false): Promise<void> {
  console.log('🔍 Inspecting catalog state for baseline seeding...');

  try {
    const [categoryCount, userCount] = await Promise.all([
      prisma.category.count(),
      prisma.user.count(),
    ]);

    const isDatabaseEmpty = categoryCount === 0 && userCount === 0;

    if (isDatabaseEmpty || forceSeed) {
      console.log('   📦 Database is unpopulated. Triggering baseline catalog seed...');
      await seedCatalog();
    } else {
      console.log(
        `   ℹ Catalog already initialized (${categoryCount} categories, ${userCount} users found). Skipping seed.`
      );
    }
  } catch (error) {
    console.error('❌ Failed to verify catalog state:', error);
    throw error;
  }
}

/**
 * Master Database Self-Provisioning Engine.
 * Provides zero-ops bootstrap for new white-label client instances:
 * 1. Resilient Neon cold-start connection loop
 * 2. Automatic migration / schema deployment
 * 3. Idempotent baseline catalog seeding
 */
export async function bootstrapDatabase(
  options: BootstrapOptions = {}
): Promise<void> {
  const { maxRetries = 5, initialBackoffMs = 1000, forceSeed = false } = options;
  const start = performance.now();

  console.log('\n============================================================');
  console.log('⚡ Neon Serverless Database Self-Provisioning Engine');
  console.log('============================================================');

  try {
    // 1. Resilient Connection Wait (handles Neon compute scale-from-zero)
    await waitForDatabaseConnection(maxRetries, initialBackoffMs);

    // 2. Schema Synchronization (Migrations or DB Push)
    await runSchemaSynchronization();

    // 3. Baseline Data Seeding
    await ensureBaselineCatalog(forceSeed);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`🎉 Self-provisioning pipeline completed in ${elapsed}s`);
    console.log('============================================================\n');
  } catch (error) {
    console.error('💥 Database self-provisioning encountered a fatal error:', error);
    throw error;
  }
}

// Standalone execution entrypoint: `bun src/db/bootstrap.ts`
if (import.meta.main) {
  const forceSeed = process.argv.includes('--force-seed');
  bootstrapDatabase({ forceSeed })
    .catch((err) => {
      console.error('Fatal bootstrapping failure:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
