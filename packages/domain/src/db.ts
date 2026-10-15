import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

const migrationsDirectory = join(__dirname, 'migrations');

/** Apply each numbered migration once, serializing concurrent runners with a transaction lock. */
export async function migrate(pool: Pool): Promise<void> {
  const files = (await readdir(migrationsDirectory)).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [12794749, 1]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const completed = new Set(applied.rows.map(row => row.name));
    for (const name of files) {
      if (completed.has(name)) continue;
      await client.query(await readFile(join(migrationsDirectory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
