import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pokerprofiles:ujgbtfRBWlZIimADkBvWyvNR8E9ClfJS@dpg-d41na8jipnbc73fhh7d0-a/pokerprofiles';

async function fixDatabase() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔧 Fixing database schema...\n');

    // Drop incorrectly structured tables
    console.log('Dropping incorrect tables...');
    await pool.query('DROP TABLE IF EXISTS observation CASCADE');
    console.log('   ✅ Dropped observation table');

    await pool.query('DROP TABLE IF EXISTS cue CASCADE');
    console.log('   ✅ Dropped cue table');

    await pool.query('DROP TABLE IF EXISTS note CASCADE');
    console.log('   ✅ Dropped note table');

    console.log('\n✅ Old tables dropped! Now run setup_database.js to recreate them.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixDatabase();
