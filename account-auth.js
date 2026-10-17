'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { createRecovery } = require('./account-recovery');
const validPassword = value => typeof value === 'string' && [...value].length >= 8 && [...value].length <= 128 && Buffer.byteLength(value, 'utf8') <= 512;
const COST = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const random = () => crypto.randomBytes(32).toString('hex');
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function createAuth(db, { sessionTtl = 8 * 60 * 60 * 1000 } = {}) {
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_sessions (
      token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_limits (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );`);
  const recovery = createRecovery(db);
  const cookieName = 'cc_local_session';
  let hashing = 0;
  function cookieToken(req) {
    const entry = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='));
    const value = entry?.slice(cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
  }
  function session(req) {
    const token = cookieToken(req);
    if (!token) return null;
    const row = db.prepare(`SELECT s.account_id, s.csrf, s.expires_at, a.username, a.role, a.credential_version
      FROM login_sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?`).get(tokenHash(token));
    if (!row) return null;
    if (row.expires_at <= Date.now()) { db.prepare('DELETE FROM login_sessions WHERE token_hash = ?').run(tokenHash(token));recovery.audit(row.account_id, row.account_id, 'session-expired', 'success');return null; }
    return { id: row.account_id, username: row.username, role: row.role, credentialVersion: row.credential_version, csrf: row.csrf };
  }
  function revoke(req) { const token = cookieToken(req);if (token) db.prepare('DELETE FROM login_sessions WHERE token_hash = ?').run(tokenHash(token)); }
  function startSession(req, res, user) {
    revoke(req);
    db.prepare('DELETE FROM login_sessions WHERE expires_at <= ?').run(Date.now());
    const token = random(), csrf = random();
    db.prepare('INSERT INTO login_sessions (token_hash, account_id, csrf, expires_at) VALUES (?, ?, ?, ?)').run(tokenHash(token), user.id, csrf, Date.now() + sessionTtl);
    // HTTP cookie is strictly a loopback-test exception. HTTPS deployment is not enabled.
    res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionTtl / 1000)}`);
    recovery.audit(user.id, user.id, 'session-started', 'success');
    return { user: { id: user.id, username: user.username, role: user.role || 'member' }, csrf };
  }
  function limited(key, max) {
    const now = Date.now();
    db.prepare('DELETE FROM auth_limits WHERE expires_at <= ?').run(now);
    const row = db.prepare('SELECT count FROM auth_limits WHERE key = ?').get(key);
    if (row && row.count >= max) return true;
    db.prepare('INSERT INTO auth_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1').run(key, now + 15 * 60 * 1000);
    return false;
  }
  async function derive(password, salt) {
    if (hashing >= 2) { const error = Error('Busy');error.status = 503;throw error; }
    hashing++;
    try { return (await scrypt(password, salt, 64, COST)).toString('hex'); }
    finally { hashing--; }
  }
  async function handle(req, res, pathname, input, reply) {
    if (pathname === '/api/auth/change-password') return changePassword(req, res, input, reply);
    if (pathname === '/api/auth/reset') return resetPassword(req, res, input, reply);
    if (pathname.startsWith('/api/admin/')) return admin(req, res, pathname, input, reply);
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const user = session(req);
      return reply(res, 200, user ? { user: { id: user.id, username: user.username, role: user.role || 'member' }, csrf: user.csrf } : { user: null });
    }
    if (req.method !== 'POST') return reply(res, 405, { message: 'Method not allowed.' });
    if (pathname === '/api/auth/logout') {
      const user = session(req);
      if (!user) return reply(res, 401, { message: 'Sign in first.' });
      if (!safeEqual(req.headers['x-csrf-token'], user.csrf)) return reply(res, 403, { message: 'Invalid session request.' });
      revoke(req);recovery.audit(user.id, user.id, 'logout', 'success');res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
      return reply(res, 200, { message: 'Signed out.' });
    }
    if (!['/api/auth/register', '/api/auth/login'].includes(pathname)) return reply(res, 404, { message: 'Not found.' });
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(res, 400, { message: 'Enter a username and passphrase.' });
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const password = input.password;
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || typeof password !== 'string' || [...password].length < 8 || [...password].length > 128 || Buffer.byteLength(password, 'utf8') > 512) return reply(res, 400, { message: 'Use a 3–32 character username and a 8–128 character passphrase.' });
    const ip = req.socket.remoteAddress || 'local';
    if (limited('ip:' + ip, 30) || limited('name:' + username, 10)) { recovery.audit('anonymous', null, 'authentication-throttled', 'denied');res.setHeader('Retry-After', '900');return reply(res, 429, { message: 'Too many attempts. Try again in 15 minutes.' }); }
    const existing = db.prepare('SELECT id, username, salt, password_hash, role, credential_version FROM accounts WHERE username = ?').get(username);
    if (pathname === '/api/auth/login') {
      // Unknown names still perform the same expensive password calculation.
      const salt = existing?.salt || 'local-dummy-salt-for-unknown-names';
      const hash = await derive(password, salt);
      const fresh = existing ? db.prepare('SELECT password_hash, credential_version FROM accounts WHERE id = ?').get(existing.id) : null;
      if (!existing || fresh?.credential_version !== existing.credential_version || !safeEqual(hash, existing.password_hash)) { recovery.audit('anonymous', existing?.id, 'login', 'denied');return reply(res, 401, { message: 'Username or passphrase is incorrect.' }); }
      return reply(res, 200, startSession(req, res, existing));
    }
    const salt = crypto.randomBytes(16).toString('hex'), hash = await derive(password, salt);
    if (existing) return reply(res, 400, { message: 'Unable to create this account. Try another username or sign in.' });
    const user = { id: crypto.randomUUID(), username, role: 'member' };
    try { db.prepare('INSERT INTO accounts (id, username, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, username, salt, hash, new Date().toISOString()); }
    catch (error) { if (String(error.code).includes('CONSTRAINT')) return reply(res, 400, { message: 'Unable to create this account. Try another username or sign in.' });throw error; }
    recovery.audit(user.id, user.id, 'account-created', 'success');
    return reply(res, 201, startSession(req, res, user));
  }
  async function resetPassword(req, res, input, reply) {
    if (req.method !== 'POST') return reply(res, 405, { message: 'Use POST.' });
    const ip = req.socket.remoteAddress || 'local';
    if (limited('reset-ip:' + ip, 20)) { res.setHeader('Retry-After', '900');return reply(res, 429, { message: 'Too many reset attempts. Try again in 15 minutes.' }); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || !validPassword(input.password) || input.password !== input.confirmPassword) return reply(res, 400, { message: 'Enter matching new passphrases of 8–128 characters.' });
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const code = typeof input.code === 'string' ? input.code.trim().toLowerCase() : '';
    const reset = recovery.find(code, username);
    if (!reset) { recovery.audit('anonymous', null, 'reset-rejected', 'invalid-or-expired');return reply(res, 400, { message: 'Reset code is invalid, expired, or already used.' }); }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await derive(input.password, salt);
    if (!recovery.complete(code, username, reset.credential_version, salt, hash)) return reply(res, 400, { message: 'Reset code is invalid, expired, or already used.' });
    reply(res, 200, { message: 'Passphrase reset. Previous sessions are signed out. Sign in with your new passphrase.' });
  }
  async function changePassword(req, res, input, reply) {
    if (req.method !== 'POST') return reply(res, 405, { message: 'Use POST.' });
    const user = session(req);
    if (!user) return reply(res, 401, { message: 'Sign in again before changing your passphrase.' });
    if (!safeEqual(req.headers['x-csrf-token'], user.csrf)) return reply(res, 403, { message: 'Invalid session request.' });
    if (!input || typeof input !== 'object' || Array.isArray(input) || !validPassword(input.currentPassword) || !validPassword(input.password) || input.password !== input.confirmPassword) return reply(res, 400, { message: 'Enter your current passphrase and matching new passphrases of 8–128 characters.' });
    if (limited('password-change:' + user.id, 5)) { res.setHeader('Retry-After', '900');return reply(res, 429, { message: 'Too many attempts. Try again in 15 minutes.' }); }
    const existing = db.prepare('SELECT salt, password_hash, credential_version FROM accounts WHERE id = ?').get(user.id);
    const currentHash = await derive(input.currentPassword, existing.salt);
    if (!safeEqual(currentHash, existing.password_hash)) { recovery.audit(user.id, user.id, 'password-change', 'denied');return reply(res, 401, { message: 'Current passphrase is incorrect.' }); }
    if (input.password === input.currentPassword) return reply(res, 400, { message: 'Choose a new passphrase different from your current one.' });
    const salt = crypto.randomBytes(16).toString('hex'), hash = await derive(input.password, salt);
    db.exec('BEGIN IMMEDIATE');
    try {
      const fresh = session(req);
      if (!fresh || fresh.id !== user.id || fresh.credentialVersion !== existing.credential_version) {
        db.exec('ROLLBACK');return reply(res, 401, { message: 'Your session changed. Sign in again before changing your passphrase.' });
      }
      db.prepare('UPDATE accounts SET salt = ?, password_hash = ?, credential_version = credential_version + 1 WHERE id = ?').run(salt, hash, user.id);
      db.prepare('DELETE FROM login_sessions WHERE account_id = ?').run(user.id);
      db.prepare('UPDATE password_resets SET used_at = ? WHERE account_id = ? AND used_at IS NULL').run(Date.now(), user.id);
      recovery.audit(user.id, user.id, 'password-change', 'success');db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK');throw error; }
    res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    return reply(res, 200, { message: 'Passphrase changed. All sessions are signed out. Sign in with your new passphrase. Your characters are unchanged.' });
  }
  async function admin(req, res, pathname, input, reply) {
    const user = session(req);
    if (!user) return reply(res, 401, { message: 'Sign in first.' });
    if (user.role !== 'admin') { recovery.audit(user.id, null, 'admin-access', 'denied');return reply(res, 403, { message: 'Administrator access required.' }); }
    if (pathname === '/api/admin/accounts' && req.method === 'GET') {
      const accounts = db.prepare('SELECT id, username, role, created_at FROM accounts ORDER BY username').all();
      return reply(res, 200, { accounts });
    }
    if (pathname === '/api/admin/audit' && req.method === 'GET') return reply(res, 200, { events: db.prepare('SELECT actor_id, target_account_id, action, outcome, created_at FROM security_audit ORDER BY id DESC LIMIT 50').all() });
    if (pathname !== '/api/admin/recovery' || req.method !== 'POST') return reply(res, 404, { message: 'Not found.' });
    if (!safeEqual(req.headers['x-csrf-token'], user.csrf)) return reply(res, 403, { message: 'Invalid session request.' });
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.identityConfirmed !== true || !validPassword(input.password) || typeof input.accountId !== 'string') return reply(res, 400, { message: 'Verify the person’s identity and enter your administrator passphrase.' });
    if (limited('admin-reset:' + user.id, 5)) { res.setHeader('Retry-After', '900');return reply(res, 429, { message: 'Too many administrator reset attempts. Try again in 15 minutes.' }); }
    const existing = db.prepare('SELECT salt, password_hash, credential_version FROM accounts WHERE id = ?').get(user.id);
    const hash = await derive(input.password, existing.salt);
    const fresh = session(req);
    if (!fresh || fresh.role !== 'admin' || fresh.credentialVersion !== existing.credential_version || !safeEqual(hash, existing.password_hash)) { recovery.audit(user.id, null, 'admin-reauth', 'denied');return reply(res, 401, { message: 'Administrator verification failed. Sign in again if needed.' }); }
    const target = db.prepare('SELECT id, role FROM accounts WHERE id = ?').get(input.accountId);
    if (!target) return reply(res, 404, { message: 'Account not found.' });
    if (target.role === 'admin') return reply(res, 403, { message: 'Administrator recovery requires the local owner command.' });
    const reset = recovery.issue(target.id, user.id);
    return reply(res, 201, { ...reset, message: 'Share this code only with the verified account holder. It expires in 15 minutes and can be used once.' });
  }
  return { session, handle, validCsrf: (req, user) => safeEqual(req.headers['x-csrf-token'], user.csrf) };
}
module.exports = { createAuth, COST };
