'use strict';
const { projectRoot } = require('./paths');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createAuth } = require('./account-auth');
const { createAuditFile } = require('./account-audit-file');
const { createBackups } = require('./account-backups');
function createAccountServer(options = {}) {
  const privateOrigin = options.privateOrigin ? new URL(options.privateOrigin) : null;
  if (privateOrigin && (privateOrigin.protocol !== 'https:' || privateOrigin.port || privateOrigin.username || privateOrigin.password || privateOrigin.pathname !== '/' || privateOrigin.search || privateOrigin.hash || !privateOrigin.hostname.endsWith('.ts.net'))) throw Error('Configure an HTTPS Tailscale hostname only.');
  const databasePath = options.databasePath || path.join(projectRoot, 'character-chronicle-accounts-test.db');
  const db = new DatabaseSync(databasePath);
  const publicPath = options.publicPath || path.join(projectRoot, 'frontend');
  const auth = createAuth(db, options);
  const refreshAuditFile = createAuditFile(db, options.auditLogPath || path.join(path.dirname(databasePath), 'logs', 'security-audit.log'));
  refreshAuditFile();
  db.exec(`CREATE TABLE IF NOT EXISTS account_books (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id), data TEXT NOT NULL,
    revision INTEGER NOT NULL, updated_at TEXT NOT NULL
  )`);
  const read = db.prepare('SELECT data, revision FROM account_books WHERE account_id = ?');
  const backups = createBackups(db, databasePath, { directory:options.backupDirectory, interval:options.backupInterval });
  backups.run();
  const backupTimer = setInterval(() => backups.run(), 60 * 60 * 1000);backupTimer.unref();
  const insert = db.prepare('INSERT INTO account_books (account_id, data, revision, updated_at) VALUES (?, ?, 1, ?)');
  const update = db.prepare('UPDATE account_books SET data = ?, revision = revision + 1, updated_at = ? WHERE account_id = ? AND revision = ?');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  function reply(res, status, data) { if (res.writableEnded) return;res.writeHead(status, { 'Content-Type': 'application/json' });res.end(JSON.stringify(data)); }
  function validBook(book) {
    if (!book || typeof book !== 'object' || Array.isArray(book) || book.version !== 1 || !Array.isArray(book.characters) || book.characters.length > 1000) return false;
    const ids = new Set();
    for (const c of book.characters) {
      if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id || c.id.length > 200 || ids.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || !Array.isArray(c.classes) || !Number.isInteger(c.maxHp) || c.maxHp < 1 || !Number.isInteger(c.hp) || c.hp < 0 || c.hp > c.maxHp) return false;
      ids.add(c.id);
    }
    return book.active == null || ids.has(book.active);
  }
  function readJson(req, max) {
    return new Promise((resolve, reject) => {
      let size = 0, chunks = [], stopped = false;
      req.on('data', chunk => {
        if (stopped) return;
        size += chunk.length;
        if (size > max) { stopped = true;chunks = [];reject(Object.assign(Error('Request too large.'), { status: 413 }));return; }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (stopped) return;
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(Object.assign(Error('Invalid JSON.'), { status: 400 })); }
      });
      req.on('error', () => reject(Object.assign(Error('Request interrupted.'), { status: 400 })));
      req.on('aborted', () => reject(Object.assign(Error('Request interrupted.'), { status: 400 })));
    });
  }
  const server = http.createServer(async (req, res) => {
    res.once('finish', refreshAuditFile);
    res.setHeader('Cache-Control', 'no-store');res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const port = server.address()?.port;
      const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const privateRequest = loopback && privateOrigin && req.headers.host === privateOrigin.host;
      if (!loopback || (!privateRequest && ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host))) return reply(res, 421, { message: 'Configured app address required.' });
      // Never infer trust from client-supplied forwarding headers.
      req.ccSecureTransport = Boolean(privateRequest);
      const requestOrigin = privateRequest ? privateOrigin.origin : `http://${req.headers.host}`;
      const url = new URL(req.url, requestOrigin);
      // A link from another site may open the public app shell, never its APIs.
      const externalNavigation = ['GET', 'HEAD'].includes(req.method) &&
        ['/', '/index.html'].includes(url.pathname) &&
        req.headers['sec-fetch-mode'] === 'navigate' &&
        req.headers['sec-fetch-dest'] === 'document';
      if ((req.headers.origin && req.headers.origin !== requestOrigin) ||
          (req.headers['sec-fetch-site'] === 'cross-site' && !externalNavigation)) return reply(res, 403, { message: 'Cross-site request rejected.' });
      const mutation = !['GET', 'HEAD'].includes(req.method);
      if (url.pathname.startsWith('/api/')) {
        if (mutation && (req.headers['x-cc-client'] !== '1' || req.headers['content-type']?.split(';')[0].trim() !== 'application/json')) return reply(res, 403, { message: 'JSON app request required.' });
        if ((url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/admin/'))) {
          const input = mutation && !url.pathname.endsWith('/logout') ? await readJson(req, 4096) : null;
          return await auth.handle(req, res, url.pathname, input, reply);
        }
        if (url.pathname !== '/api/book') return reply(res, 404, { message: 'Not found.' });
        const user = auth.session(req);
        if (!user) return reply(res, 401, { message: 'Sign in to access your server book.' });
        if (req.method === 'GET') {
          const row = read.get(user.id);
          return reply(res, 200, { accountId: user.id, book: row ? JSON.parse(row.data) : null, revision: row?.revision || 0 });
        }
        if (req.method !== 'PUT') return reply(res, 405, { message: 'Use GET or PUT.' });
        if (!auth.validCsrf(req, user)) return reply(res, 403, { message: 'Invalid session request.' });
        const input = await readJson(req, 10 * 1024 * 1024);
        if (!auth.session(req)) return reply(res, 401, { message: 'Session expired. Sign in again.' });
        // Owner comes from the session; client ID only guards against stale tabs.
        if (!input || input.accountId !== user.id) return reply(res, 403, { message: 'Account changed. Sign in again before syncing.' });
        if (!Number.isSafeInteger(input.revision) || input.revision < 0 || !validBook(input.book)) return reply(res, 400, { message: 'Invalid complete character book.' });
        try {
          db.exec('BEGIN IMMEDIATE');
          const row = read.get(user.id);
          if ((row?.revision || 0) !== input.revision) { db.exec('ROLLBACK');return reply(res, 409, { message: 'Newer server copy exists. Local changes kept.', revision: row?.revision || 0 }); }
          const json = JSON.stringify(input.book), now = new Date().toISOString();
          if (row) update.run(json, now, user.id, input.revision);else insert.run(user.id, json, now);
          db.exec('COMMIT');return reply(res, row ? 200 : 201, { accountId: user.id, revision: input.revision + 1 });
        } catch (error) { try { db.exec('ROLLBACK'); } catch {}throw error; }
      }
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { message: 'Method not allowed.' });
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!/^[a-zA-Z0-9._-]+$/.test(name) || !Object.hasOwn(types, path.extname(name))) return reply(res, 404, { message: 'Page not found.' });
      if (name === 'sw.js') res.setHeader('Service-Worker-Allowed', '/');
      const contents = await fs.promises.readFile(path.join(publicPath, name)).catch(() => null);
      if (!contents) return reply(res, 404, { message: 'Page not found.' });
      res.writeHead(200, { 'Content-Type': types[path.extname(name)] });res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (error) { reply(res, error.status || 500, { message: [400, 413].includes(error.status) ? error.message : error.status === 503 ? 'Server busy. Try again shortly.' : 'Request could not be completed.' }); }
  });
  server.requestTimeout = 15000;server.on('close', () => { clearInterval(backupTimer);refreshAuditFile();db.close(); });return server;
}
module.exports = { createAccountServer };
function main() {
  const configPath = path.join(projectRoot, 'private-admin', 'private-access.json');
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
  const server = createAccountServer({ privateOrigin: config.privateOrigin });
  server.listen(3002, '127.0.0.1', () => console.log('Optional account TEST: http://127.0.0.1:3002 — loopback only, test passphrases only'));
  server.on('error', error => { console.error('Account test server:', error.message);process.exitCode = 1; });
  process.on('SIGINT', () => server.close());
}

module.exports.main = main;
if (require.main === module) main();
