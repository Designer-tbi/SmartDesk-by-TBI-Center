import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

try {
  db.exec('ALTER TABLE companies ADD COLUMN country TEXT DEFAULT "FR"');
  console.log('Added country column');
} catch (e) {
  console.log('country column may already exist', e.message);
}

try {
  db.exec('ALTER TABLE companies ADD COLUMN state TEXT');
  console.log('Added state column');
} catch (e) {
  console.log('state column may already exist', e.message);
}

console.log('Migration complete');
