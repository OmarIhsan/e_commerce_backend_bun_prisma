import { PrismaClient } from '@prisma/client';

// Singleton instance pattern adhering to sickn33/prisma-expert guidelines:
// Prevents connection pool leaks during Bun hot-reloading in development.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
            // Uncomment to debug raw SQL queries:
            // { emit: 'stdout', level: 'query' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful connection lifecycle cleanup
const handleShutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
