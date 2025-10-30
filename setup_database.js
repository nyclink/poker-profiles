import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

const EMAIL = 'isaaczahavi@gmail.com';
const PASSWORD = 'ppp@2025!';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pokerprofiles:ujgbtfRBWlZIimADkBvWyvNR8E9ClfJS@dpg-d41na8jipnbc73fhh7d0-a/pokerprofiles';

async function setupDatabase() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔧 Setting up database...\n');

    // Create UUID extension
    console.log('1/7 Creating UUID extension...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('   ✅ UUID extension ready');

    // Create app_user table
    console.log('2/7 Creating app_user table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_user (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ app_user table created');

    // Create player table
    console.log('3/7 Creating player table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        table_image VARCHAR(100),
        confidence SMALLINT DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 5),
        zones_json TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_player_user ON player(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_player_updated ON player(updated_at DESC)');
    console.log('   ✅ player table created');

    // Create note table
    console.log('4/7 Creating note table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note (
        id SERIAL PRIMARY KEY,
        player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_note_player ON note(player_id, created_at DESC)');
    console.log('   ✅ note table created');

    // Create cue table
    console.log('5/7 Creating cue table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cue (
        id SERIAL PRIMARY KEY,
        zone VARCHAR(40) NOT NULL,
        label VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log('   ✅ cue table created');

    // Create observation table
    console.log('6/7 Creating observation table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS observation (
        id BIGSERIAL PRIMARY KEY,
        player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        bucket SMALLINT NOT NULL CHECK (bucket IN (1, 2, 3, 4)),
        cue_id INTEGER REFERENCES cue(id) ON DELETE SET NULL,
        free_text VARCHAR(400),
        hand_outcome SMALLINT CHECK (hand_outcome IN (0, 1, 2, 3)),
        tilt_state SMALLINT CHECK (tilt_state IN (0, 1, 2, 3)),
        stack_situation SMALLINT CHECK (stack_situation IN (0, 1, 2, 3)),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_obs_player_time ON observation(player_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_obs_player_bucket ON observation(player_id, bucket, created_at DESC)');
    console.log('   ✅ observation table created');

    console.log('\n✅ All tables created successfully!\n');

    // Insert behavioral cues
    console.log('7/7 Inserting behavioral cues...');
    await pool.query(`
      INSERT INTO cue (zone, label) VALUES
        ('hands', 'Chip fumble'),
        ('hands', 'Fast grab/throw'),
        ('voice', 'Overtalking'),
        ('voice', 'Flat/quiet'),
        ('eyes', 'Locked stare'),
        ('eyes', 'Looks away'),
        ('face', 'Jaw relax'),
        ('face', 'Lips press'),
        ('posture', 'Leans in'),
        ('posture', 'Freezes up'),
        ('breathing', 'Breath spike'),
        ('timing', 'Instant bet'),
        ('timing', 'Long tank')
      ON CONFLICT DO NOTHING
    `);
    console.log('   ✅ Behavioral cues inserted');

    // Check if admin user exists
    console.log('\n🔐 Creating admin user...');
    const existing = await pool.query('SELECT id FROM app_user WHERE email=$1', [EMAIL]);

    if (existing.rows.length > 0) {
      console.log('   ⚠️  Admin user already exists!');
      console.log(`   User ID: ${existing.rows[0].id}`);
      console.log(`   Email: ${EMAIL}`);
    } else {
      // Create admin user
      const hash = await bcrypt.hash(PASSWORD, 10);
      const result = await pool.query(
        'INSERT INTO app_user (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [EMAIL, hash]
      );
      console.log('   ✅ Admin user created!');
      console.log(`   User ID: ${result.rows[0].id}`);
      console.log(`   Email: ${result.rows[0].email}`);
    }

    console.log('\n════════════════════════════════════════════');
    console.log('🎉 DATABASE SETUP COMPLETE!');
    console.log('════════════════════════════════════════════\n');
    console.log('Login credentials:');
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log('\n🌐 Login URL:');
    console.log('   https://poker-profiles-2.onrender.com/login.html\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

setupDatabase();
