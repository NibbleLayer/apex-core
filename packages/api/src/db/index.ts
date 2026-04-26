import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@nibblelayer/apex-persistence/db';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
export { pool };
