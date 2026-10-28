import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

async function run() {
  const url = process.argv.includes('--test')
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString: url });

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const dir = path.resolve(__dirname, '../../database/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const f of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [f]);
    if (done.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log('applied', f);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('FAILED', f, e.message);
      process.exit(1);
    } finally {
      client.release();
    }
  }
  await pool.end();
}

run();