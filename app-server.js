'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// This separate database stores the entire book, including unknown future fields.
function createAppServer(options = {}) {
  const databasePath = options.databasePath || path.join(__dirname, 'character-chronicle-app-test.db');
  const publicPath = options.publicPath || path.join(__dirname, 'legacy', 'app-preview');
  const db = new DatabaseSync(databasePath);
  db.exec(`CREATE TABLE IF NOT EXISTS character_books (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  const read = db.prepare('SELECT data, revision, updated_at FROM character_books WHERE id = ?');
  const insert = db.prepare('INSERT INTO character_books (id, data, revision, updated_at) VALUES (?, ?, 1, ?)');
  const update = db.prepare('UPDATE character_books SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  function reply(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }
  function validBook(book) {
    if (!book || typeof book !== 'object' || Array.isArray(book) || book.version !== 1 || !Array.isArray(book.characters)) return false;
    const ids = new Set();
    for (const c of book.characters) {
      if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id || c.id.length > 200 || ids.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || !Array.isArray(c.classes) || !Number.isInteger(c.maxHp) || c.maxHp < 1 || !Number.isInteger(c.hp) || c.hp < 0 || c.hp > c.maxHp) return false;
      ids.add(c.id);
    }
    return book.active == null || ids.has(book.active);
  }
  const server = http.createServer((req, res) => {
    // A local-only prototype. Do not expose this service publicly without accounts.
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reply(res, 403, { message: 'Use the app served by this local server.' });
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/book') {
      if (req.method === 'GET') {
        try {
          const row = read.get('local-test');
          return reply(res, 200, row ? { book: JSON.parse(row.data), revision: row.revision } : { book: null, revision: 0 });
        } catch { return reply(res, 500, { message: 'Could not read the test book.' }); }
      }
      if (req.method !== 'PUT') return reply(res, 405, { message: 'Use GET or PUT.' });
      let size = 0, chunks = [], rejected = false;
      req.on('data', chunk => {
        if (rejected) return;
        size += chunk.length;
        if (size > 10 * 1024 * 1024) { rejected = true; chunks = []; reply(res, 413, { message: 'Book exceeds the 10 MB test limit.' }); return; }
        chunks.push(chunk);
      });
      req.on('error', () => { if (!res.writableEnded) reply(res, 400, { message: 'Request interrupted.' }); });
      req.on('end', () => {
        if (rejected) return;
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return reply(res, 400, { message: 'Invalid JSON.' }); }
        if (!input || !Number.isSafeInteger(input.revision) || input.revision < 0 || !validBook(input.book)) return reply(res, 400, { message: 'Invalid complete character book.' });
        try {
          // Compare-and-save happens inside a transaction: stale clients cannot overwrite.
          db.exec('BEGIN IMMEDIATE');
          const row = read.get('local-test');
          if ((row?.revision || 0) !== input.revision) {
            db.exec('ROLLBACK');
            return reply(res, 409, { message: 'The server copy changed. Download a backup before loading it.', revision: row?.revision || 0 });
          }
          const text = JSON.stringify(input.book), now = new Date().toISOString();
          if (row) update.run(text, now, 'local-test', input.revision);
          else insert.run('local-test', text, now);
          db.exec('COMMIT');
          reply(res, row ? 200 : 201, { revision: input.revision + 1 });
        } catch {
          try { db.exec('ROLLBACK'); } catch {}
          reply(res, 500, { message: 'Could not save the test book.' });
        }
      });
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { message: 'Method not allowed.' });
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    // Serve only top-level UI assets; never server source or database files.
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || !Object.hasOwn(types, path.extname(name))) return reply(res, 404, { message: 'Page not found.' });
    fs.readFile(path.join(publicPath, name), (error, contents) => {
      if (error) return reply(res, 404, { message: 'Page not found.' });
      res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    });
  });
  server.requestTimeout = 15000;
  server.on('close', () => db.close());
  return server;
}
module.exports = { createAppServer };
if (require.main === module) {
  const server = createAppServer();
  server.listen(3001, '127.0.0.1', () => console.log('Character Chronicle test app: http://127.0.0.1:3001 — separate test data only'));
  server.on('error', error => { console.error('Could not start test server:', error.message); process.exitCode = 1; });
  process.on('SIGINT', () => server.close());
}
