const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const db = new DatabaseSync(
  path.join(__dirname, 'character-chronicle.db')
);

const server = http.createServer((request, response) => {

  if (request.url === '/' && request.method === 'GET') {
    const page = fs.readFileSync(
      path.join(__dirname, 'index.html'),
      'utf8'
    );

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }
  const characterMatch = request.url.match(/^\/characters\/([1-9]\d*)$/);

  if (characterMatch && request.method === 'PATCH') {
    const characterId = Number(characterMatch[1]);
    const character = db.prepare(
      'SELECT * FROM characters WHERE id = ?'
    ).get(characterId);

    if (!character) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        message: 'Character not found'
      }));
      return;
    }
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      try {
        const updates = JSON.parse(body);

        if (
          !Number.isInteger(updates.level) ||
          updates.level < 1 ||
          updates.level > 20
        ) {
          response.writeHead(400, {
            'Content-Type': 'application/json'
          });
          response.end(JSON.stringify({
            message: 'Level must be a whole number from 1–20'
          }));
          return;
        }

        db.prepare(
          'UPDATE characters SET level = ? WHERE id = ?'
        ).run(updates.level, characterId);
        response.writeHead(200, {
          'Content-Type': 'application/json'
        });
        response.end(JSON.stringify({
          message: 'Character level updated'
        }));
      } catch {
        response.writeHead(400, {
          'Content-Type': 'application/json'
        });
        response.end(JSON.stringify({
          message: 'Invalid update information'
        }));
      }
    });

    return;
  }
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
      } catch (error) {
        console.error(error);

        const invalidJson = error instanceof SyntaxError;

        response.writeHead(invalidJson ? 400 : 500, {
          'Content-Type': 'application/json'
        });

        response.end(JSON.stringify({
          message: invalidJson
            ? 'Invalid JSON'
            : 'Could not save character'
        }));

        return;
      }
      response.writeHead(201, { 'Content-Type': 'application/json' });
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

  response.writeHead(404, { 'Content-Type': 'text/plain' });
  response.end('Page not found');
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Open http://127.0.0.1:3000 in your browser');
});