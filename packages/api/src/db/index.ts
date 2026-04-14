import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@nibblelayer/apex-persistence/db';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev',
});

export const db = drizzle(pool, { schema });
export { pool };
