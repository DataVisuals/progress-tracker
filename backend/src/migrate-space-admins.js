const { dbRun, dbGet, dbAll } = require('./db');
const fs = require('fs');
const path = require('path');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

// Hash password using same method as server.js
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return salt + ':' + derivedKey.toString('hex');
}

// Default system admin credentials
const SYSTEM_ADMIN_EMAIL = 'sysadmin@progress-tracker.local';
const SYSTEM_ADMIN_NAME = 'System Administrator';
const SYSTEM_ADMIN_PASSWORD = 'admin123';

async function migrateSpaceAdmins() {
  console.log('🔄 Starting space admin migration...');

  try {
    // Step 1: Run the SQL migration
    console.log('📋 Creating space_admin_assignments table...');

    const migrationSql = fs.readFileSync(
      path.join(__dirname, 'migrations/add-space-admins.sql'),
      'utf8'
    );

    // Split and run each statement separately
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        await dbRun(statement);
      }
    }
    console.log('✅ Created space_admin_assignments table');

    // Step 2: Ensure we have system admin users set up
    console.log('👤 Checking system admin users...');

    let systemAdmins = await dbAll('SELECT id, email, name FROM users WHERE is_system_admin = 1');

    if (systemAdmins.length === 0) {
      console.log('⚠️  No system admin users found, creating default system admin...');

      // Check if the default system admin email already exists
      const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [SYSTEM_ADMIN_EMAIL]);

      if (existingUser) {
        // Update existing user to be system admin
        await dbRun('UPDATE users SET is_system_admin = 1, role = ? WHERE id = ?', ['admin', existingUser.id]);
        console.log(`✅ Promoted existing user to system admin: ${SYSTEM_ADMIN_EMAIL}`);
      } else {
        // Create new system admin user
        const passwordHash = await hashPassword(SYSTEM_ADMIN_PASSWORD);
        await dbRun(
          'INSERT INTO users (email, name, password_hash, role, is_system_admin) VALUES (?, ?, ?, ?, ?)',
          [SYSTEM_ADMIN_EMAIL, SYSTEM_ADMIN_NAME, passwordHash, 'admin', 1]
        );
        console.log(`✅ Created system admin: ${SYSTEM_ADMIN_EMAIL}`);
        console.log(`   Password: ${SYSTEM_ADMIN_PASSWORD}`);
      }

      // Refresh the list
      systemAdmins = await dbAll('SELECT id, email, name FROM users WHERE is_system_admin = 1');
    }

    console.log(`✅ Found ${systemAdmins.length} system admin(s):`);
    systemAdmins.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email})`);
    });

    // Step 3: List regular admins that need space assignments
    console.log('\n📋 Checking regular admins for space assignments...');

    const regularAdmins = await dbAll(`
      SELECT u.id, u.email, u.name
      FROM users u
      WHERE u.role = 'admin' AND u.is_system_admin = 0
    `);

    if (regularAdmins.length === 0) {
      console.log('ℹ️  No regular admins found');
    } else {
      console.log(`Found ${regularAdmins.length} regular admin(s) that need space assignments:`);
      regularAdmins.forEach(admin => {
        console.log(`   - ${admin.name} (${admin.email}) - ID: ${admin.id}`);
      });
      console.log('\n   To assign an admin to a space, use:');
      console.log('   INSERT INTO space_admin_assignments (user_id, space_id, created_by) VALUES (user_id, space_id, your_id)');
    }

    // Step 4: Show available spaces
    console.log('\n📋 Available spaces:');
    const spaces = await dbAll('SELECT id, name FROM spaces ORDER BY display_order');

    if (spaces.length === 0) {
      console.log('⚠️  No spaces found. Create spaces first before assigning admins.');
    } else {
      spaces.forEach(space => {
        console.log(`   - Space ${space.id}: ${space.name}`);
      });
    }

    // Step 5: Show current space admin assignments
    console.log('\n📋 Current space admin assignments:');
    const assignments = await dbAll(`
      SELECT sa.id, u.name as admin_name, u.email as admin_email, s.name as space_name
      FROM space_admin_assignments sa
      JOIN users u ON sa.user_id = u.id
      JOIN spaces s ON sa.space_id = s.id
      ORDER BY s.name, u.name
    `);

    if (assignments.length === 0) {
      console.log('   No space admin assignments yet');
    } else {
      assignments.forEach(a => {
        console.log(`   - ${a.admin_name} (${a.admin_email}) → ${a.space_name}`);
      });
    }

    console.log('\n🎉 Space admin migration complete!');
    console.log('\n📝 Permission Model:');
    console.log('   - System admins (is_system_admin = 1): Full access to ALL spaces');
    console.log('   - Regular admins with space assignments: Access only to assigned spaces');
    console.log('   - Regular admins without assignments: Cannot manage any spaces');
    console.log('   - PMs/Editors: Project-level permissions only (unchanged)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migrateSpaceAdmins()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrateSpaceAdmins };
