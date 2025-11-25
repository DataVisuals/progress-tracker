const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/progress-tracker.db');

// Shape mapping - assign shapes in order to existing spaces
const SPACE_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'pentagon', 'heart'];

console.log('Starting migration: Spaces color → icon (shapes)');
console.log('Database:', DB_PATH);

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // Get all existing spaces
  db.all('SELECT id, name, color FROM spaces ORDER BY id', (err, spaces) => {
    if (err) {
      console.error('Error reading spaces:', err);
      db.close();
      return;
    }

    console.log(`\nFound ${spaces.length} spaces to migrate:`);
    spaces.forEach(space => {
      console.log(`  - ${space.name} (color: ${space.color})`);
    });

    // Step 1: Create new icon column
    console.log('\nStep 1: Adding icon column...');
    db.run('ALTER TABLE spaces ADD COLUMN icon TEXT', (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding icon column:', err);
        db.close();
        return;
      }

      console.log('Icon column added (or already exists)');

      // Step 2: Assign shapes to each space
      console.log('\nStep 2: Assigning shapes to spaces...');

      const updatePromises = spaces.map((space, index) => {
        const shape = SPACE_SHAPES[index % SPACE_SHAPES.length];
        return new Promise((resolve, reject) => {
          db.run(
            'UPDATE spaces SET icon = ? WHERE id = ?',
            [shape, space.id],
            (err) => {
              if (err) {
                console.error(`  ✗ Failed to update ${space.name}:`, err);
                reject(err);
              } else {
                console.log(`  ✓ ${space.name} → ${shape}`);
                resolve();
              }
            }
          );
        });
      });

      Promise.all(updatePromises)
        .then(() => {
          // Step 3: Remove the old color column (SQLite doesn't support DROP COLUMN directly)
          // We'll leave it for now as it requires recreating the table
          console.log('\nStep 3: Verifying migration...');

          db.all('SELECT id, name, icon, color FROM spaces', (err, updatedSpaces) => {
            if (err) {
              console.error('Error verifying migration:', err);
            } else {
              console.log('\nMigration complete! Updated spaces:');
              updatedSpaces.forEach(space => {
                console.log(`  - ${space.name}: icon=${space.icon}, old_color=${space.color}`);
              });

              console.log('\n✓ Migration successful!');
              console.log('\nNote: The old "color" column still exists but is no longer used.');
              console.log('The frontend now reads from the "icon" column.');
            }
            db.close();
          });
        })
        .catch((err) => {
          console.error('\n✗ Migration failed:', err);
          db.close();
        });
    });
  });
});
