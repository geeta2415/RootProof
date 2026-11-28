const pool = require('../db');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      email TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
      ON password_reset_tokens (expires_at);
  `);

  console.log('password_reset_tokens table is ready');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Failed to create password_reset_tokens table:', err.message);
  await pool.end();
  process.exit(1);
});