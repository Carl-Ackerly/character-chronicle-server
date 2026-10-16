const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const db = new DatabaseSync(
  path.join(__dirname, 'character-chronicle.db')
);

db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    max_hp INTEGER NOT NULL DEFAULT 10
  );
`);

console.log('Database and characters table are ready.');
console.log(db.prepare('SELECT * FROM characters').all());

db.close();