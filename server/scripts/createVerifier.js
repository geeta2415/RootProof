const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.log('Usage: node scripts/createVerifier.js "Name" email password');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'verifier')
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, role`,
    [name, email, hash]
  );

  console.log(result.rows[0] ? 'Verifier created:' : 'Email already exists', result.rows[0] || '');
  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});