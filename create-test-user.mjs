import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const hash = bcrypt.hashSync('testpass123', 10);
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'dashvora',
  user: 'postgres',
  password: 'root',
  ssl: false,
});

try {
  await pool.query(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $3',
    ['testuser@test.com', 'Test User', hash]
  );
  console.log('User created/updated');
  const r = await pool.query('SELECT id, email FROM users WHERE email = $1', ['testuser@test.com']);
  console.log(JSON.stringify(r.rows[0]));
} catch (e) {
  console.log('Error:', e.message);
} finally {
  await pool.end();
}
