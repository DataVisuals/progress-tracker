const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const { promisify } = require('util');
const path = require('path');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function resetPasswords() {
  const dbPath = path.join(__dirname, 'data/progress-tracker.db');
  const db = new sqlite3.Database(dbPath);

  const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  try {
    // Reset admin password
    const adminHash = await hashPassword('admin');
    await dbRun('UPDATE users SET password_hash = ? WHERE email = ?', [adminHash, 'admin@example.com']);
    console.log('✅ Admin password reset to: admin');

    // Reset PM password
    const pmHash = await hashPassword('pm');
    await dbRun('UPDATE users SET password_hash = ? WHERE email = ?', [pmHash, 'pm@pm.com']);
    console.log('✅ PM password reset to: pm');

    db.close();
    console.log('\n✅ Passwords reset successfully!');
    console.log('You can now log in with:');
    console.log('  Admin: admin@example.com / admin');
    console.log('  PM:    pm@pm.com / pm');
  } catch (err) {
    console.error('Error resetting passwords:', err);
    db.close();
    process.exit(1);
  }
}

resetPasswords();
