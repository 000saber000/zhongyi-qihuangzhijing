import {readFile} from 'node:fs/promises';
import type {Pool, PoolClient} from 'pg';

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7348012)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await client.query('SELECT version FROM schema_migrations WHERE version=1');
    if (!applied.rowCount) {
      await client.query(await readFile(new URL('../migrations/001-accounts.sql',import.meta.url),'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES(1)');
    }
    await client.query('COMMIT');
  } catch (error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
export async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client=await pool.connect();
  try {await client.query('BEGIN');const result=await operation(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
