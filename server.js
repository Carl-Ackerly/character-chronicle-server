const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const db = new DatabaseSync(
  path.join(__dirname, 'character-chronicle.db')
);

const server = http.createServer((request, response) => {

  // POST: test receiving a request to add a character.
    if (request.url === '/characters' && request.method === 'POST') {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      try {
  const character = JSON.parse(body);

  if (
    typeof character.name !== 'string' ||
    character.name.trim() === '' ||
    !Number.isInteger(character.level) ||
    character.level < 1 ||
    character.level > 20 ||
    !Number.isInteger(character.max_hp) ||
    character.max_hp < 1
  ) {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      message: 'Provide a name, level from 1–20, and positive whole-number max_hp.'
    }));
    return;
  }

  db.prepare(`
    INSERT INTO characters (name, level, max_hp)
    VALUES (?, ?, ?)
  `).run(
    character.name.trim(),
    character.level,
    character.max_hp
  );

  console.log('Saved character:', character.name);
} catch {
  response.writeHead(400, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ message: 'Invalid JSON' }));
  return;
}
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'Character saved' }));
    });

    return;
  }
  // GET: read the characters already saved in the database.
  if (request.url === '/characters' && request.method === 'GET') {
    const characters = db.prepare('SELECT * FROM characters').all();

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(characters));
    return;
  }

  // Other addresses show the welcome message.
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Character Chronicle server is running!');
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Open http://127.0.0.1:3000 in your browser');
});