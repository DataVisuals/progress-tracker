const crypto = require('crypto');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

(async () => {
  const dbPath = path.join(__dirname, 'backend/data/progress-tracker.db');
  const db = new sqlite3.Database(dbPath);

  const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

  const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const users = await dbAll("SELECT id, email, password_hash FROM users WHERE password_hash LIKE '$2b%'");

  console.log(`Found ${users.length} users with bcrypt hashes`);

  const newHash = await hashPassword('password123');

  for (const user of users) {
    await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    console.log(`Updated ${user.email}`);
  }

  console.log('Done! All passwords are now: password123');
  db.close();
})();
