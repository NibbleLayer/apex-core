import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@nibblelayer/apex-persistence/db';
import { afterEach, afterAll } from 'vitest';

const connectionString = process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev';

// Create a test pool with a single connection to avoid cross-connection visibility issues
const testPool = new pg.Pool({ 
  connectionString,
  max: 1, // Single connection to ensure all operations see each other's data
});
export const testDb = drizzle(testPool, { schema });

// Clean up test data after each test — wrapped in try/catch to prevent hard crashes
afterEach(async () => {
  try {
    // Delete in reverse dependency order
    await testDb.delete(schema.webhookDeliveries);
    await testDb.delete(schema.webhookEndpoints);
    await testDb.delete(schema.discoveryMetadata);
    await testDb.delete(schema.settlements);
    await testDb.delete(schema.paymentEvents);
    await testDb.delete(schema.serviceManifests);
    await testDb.delete(schema.priceRules);
    await testDb.delete(schema.routes);
    await testDb.delete(schema.walletDestinations);
    await testDb.delete(schema.environments);
    await testDb.delete(schema.services);
    await testDb.delete(schema.apiKeys);
    await testDb.delete(schema.organizations);
  } catch (err) {
    console.error('Test cleanup failed:', err);
  }
});

afterAll(async () => {
  try {
    await testPool.end();
  } catch {
    // Ignore — pool may already be closed
  }
});
