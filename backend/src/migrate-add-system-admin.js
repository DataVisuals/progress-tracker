const { dbRun, dbGet, dbAll } = require('./db');
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// Hash password using same method as server.js
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function migrateAddSystemAdmin() {
  console.log('🔄 Starting system admin migration...');

  try {
    // Step 1: Add is_system_admin column to users table if it doesn't exist
    console.log('📋 Checking for is_system_admin column...');

    // Check if column exists
    const tableInfo = await dbAll('PRAGMA table_info(users)');
    const hasSystemAdminColumn = tableInfo.some(col => col.name === 'is_system_admin');

    if (!hasSystemAdminColumn) {
      await dbRun('ALTER TABLE users ADD COLUMN is_system_admin INTEGER DEFAULT 0');
      console.log('✅ Added is_system_admin column to users table');
    } else {
      console.log('ℹ️  is_system_admin column already exists');
    }

    // Step 2: Create or update system admin user
    console.log('👤 Setting up system admin user...');

    const sysAdminEmail = 'sysadmin@progress-tracker.local';
    let sysAdmin = await dbGet('SELECT id FROM users WHERE email = ?', [sysAdminEmail]);

    if (!sysAdmin) {
      const hash = await hashPassword('spruce123');
      const result = await dbRun(
        'INSERT INTO users (email, name, password_hash, role, is_system_admin) VALUES (?, ?, ?, ?, ?)',
        [sysAdminEmail, 'System Administrator', hash, 'admin', 1]
      );
      console.log(`✅ Created system admin user (ID: ${result.lastID})`);
      console.log('   Email: sysadmin@progress-tracker.local');
      console.log('   Password: spruce123');
    } else {
      // Update existing user to be system admin
      await dbRun('UPDATE users SET is_system_admin = 1 WHERE email = ?', [sysAdminEmail]);
      console.log('✅ Updated existing sysadmin user to have system admin privileges');
    }

    console.log('\n🎉 System admin migration complete!');
    console.log('\n📝 System Admin Details:');
    console.log('   - Email: sysadmin@progress-tracker.local');
    console.log('   - Password: spruce123');
    console.log('   - Has cross-space (global) permissions');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migrateAddSystemAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrateAddSystemAdmin };
