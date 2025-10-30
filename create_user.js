import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';
import readline from 'readline';

const { Pool } = pg;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createUser() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set!');
    console.log('\nUsage:');
    console.log('  DATABASE_URL="your-connection-string" node create_user.js');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('\n🃏 Poker Profiles - Create Admin User\n');

    const email = await question('Enter email: ');
    const password = await question('Enter password: ');

    if (!email || !password) {
      console.log('\n❌ Email and password are required!');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM app_user WHERE email=$1', [email]);
    if (existingUser.rows.length > 0) {
      console.log('\n❌ User with this email already exists!');
      process.exit(1);
    }

    // Hash password
    console.log('\n⏳ Creating user...');
    const hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO app_user (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );

    console.log('\n✅ User created successfully!');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log('\nYou can now log in at your app URL!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
    rl.close();
    process.exit(0);
  }
}

createUser();
