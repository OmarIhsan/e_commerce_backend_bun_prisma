import { describe, expect, it } from 'bun:test';
import { env } from '../src/common/config/env';
import { bootstrapDatabase } from '../src/db/bootstrap';
import { seedCatalog } from '../prisma/seed';

describe('Database Self-Provisioning Engine Unit Tests', () => {
  it('env configuration provides DIRECT_URL and AUTO_BOOTSTRAP_DB', () => {
    expect(env).toHaveProperty('DIRECT_URL');
    expect(env).toHaveProperty('AUTO_BOOTSTRAP_DB');
    expect(typeof env.DIRECT_URL).toBe('string');
    expect(typeof env.AUTO_BOOTSTRAP_DB).toBe('boolean');
  });

  it('bootstrapDatabase function is exported and callable', () => {
    expect(typeof bootstrapDatabase).toBe('function');
  });

  it('seedCatalog function is exported and callable', () => {
    expect(typeof seedCatalog).toBe('function');
  });
});
