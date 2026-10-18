# Optional accounts — local prototype

Run `node account-server.js` and open http://127.0.0.1:3002.

This is a separate preview and database from the original practice server (3000), full-app single-user prototype (3001), and public GitHub Pages app. It never reads the Alaric backup or migrates existing books automatically.

## Try it

1. Without signing in, create a synthetic device-only character. It stays local.
2. Create a **test** account using a 3–32 character username and a 8–128 character passphrase. Use a test passphrase, not a password from another service.
3. The account opens its own character book. Create a synthetic account character using the existing app controls; changes upload automatically after local saving.
4. Sign in to the same account in incognito and verify the book loads.
5. Sign out and verify device-only characters return. Create a second account and verify it starts with its own empty book.

**Copy device-only characters** is explicit and allowed only when the destination account is empty. Originals remain local. It does not merge two populated books. A second browser with a signed-in cookie can use **Open my account**. **Device-only characters** changes the view without logging out; **Sign out** revokes the session and returns to device-only use.

Clean account copies can retrieve newer server changes on focus/reconnect. Pending changes upload automatically when safe. Conflicting edits are not merged: the browser keeps its local copy and asks the user to review/load. Explicit Load account copy offers a safety download and stores a local safety snapshot before replacing a nonempty local book. Downloaded files must remain private.

## Architecture

- `account-auth.js`: account validation, asynchronous salted password hashing, sessions, and persisted login throttling.
- `account-server.js`: loopback HTTP server, request defenses, and owner-scoped GET/PUT `/api/book`.
- `frontend/account-context.js`: chooses the active account's local storage key before the existing app loads.
- `frontend/account-sync.js`: optional login UI and the local-first account save bridge.
- `character-chronicle-accounts-test.db`: SQLite tables for accounts, sessions, limits, and private account books. Ignored by Git.

`account_books.account_id` belongs to an authenticated account. Ownership is selected from the server-side session, never from a requested user ID. The request's accountId is only a stale-tab guard. Books keep the complete JSON record and a revision for compare-and-save. The old `local-test` book is not copied into any account.

Each browser account copy uses its own localStorage key. The selected view is per-tab sessionStorage. Cookies are shared between tabs, so the server rejects writes when a stale tab's account identity differs from its current session. Signing out switches to the separate guest book; cached account books remain on this **trusted local browser**, unencrypted. Logout is not a promise to erase forensic/browser-local data. Shared-device clearing and encryption policies need further design before broader release.

## Implemented controls

- Passwords use Node's asynchronous scrypt with random 16-byte salts, N=131072, r=8, p=1, and 64-byte hashes. Two concurrent hash calculations maximum. Plaintext passwords are not stored or logged.
- Cryptographically random 256-bit session tokens; only their SHA-256 digests are stored. Password hashing and session-token hashing are different purposes.
- HttpOnly, SameSite=Strict, host-only session cookies; rotation at sign-in, server-side logout revocation, and an eight-hour absolute expiry.
- Session-bound CSRF tokens for writes/logout, a required custom app header and JSON content type, same-origin checks, and no CORS allowance.
- Loopback Host allowlist, no forwarding-header trust, framing protection, a restrictive script CSP, no-store responses, and private-file/asset restrictions.
- Persisted 15-minute authentication limits (30 attempts per IP, 10 per normalized username); bounded request bodies; generic credential-failure messages; expensive hashing for unknown usernames as well.
- Parameterized SQL, per-account revision checks, complete-book validation, and separate local copies for guest/account use.

## Deliberate limits — not ready for public hosting

This server listens only on **127.0.0.1** and requires a local Host address. HTTPS and proxy deployment are not implemented. Its cookie intentionally lacks Secure for this **HTTP loopback test**; remote deployment requires HTTPS, Secure cookies, and a reviewed proxy/Origin policy, not simply changing the listening address.

Administrator-assisted password recovery is now available locally; see [RECOVERY.md](RECOVERY.md). Automated email recovery, verified email, invitation-only enrollment, authenticated password changes, session-management UI, MFA/passkeys, backup automation/encryption, shared-device cache clearing, and operational security review remain future work. Registration is available only on this local test service. Login limits currently favor a small local group and need tuning before network deployment. There is no guarantee of perfect security or external security audit.

## Tests

Run `node tests/accounts.test.cjs`. Like the earlier integration tests, this requires Playwright and Microsoft Edge on the development machine. The app server itself has no external package dependencies beyond Node.js 24.

Tests use temporary SQLite databases and synthetic accounts. They check cross-account read/write isolation (including identical character IDs), password salt/hash storage, session rotation/logout/expiry, invalid credentials, CSRF, Origin/Host checks, request limits, authentication throttling, preservation of guest data, existing dashboard save integration, stale tabs after an account switch, and phone/desktop sizing.

Reference guidance: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), and [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Remaining release work

See [ROADMAP.md](ROADMAP.md) for completed checkpoints, ordered remaining tasks, acceptance checks, and the next-session plan. The create-account form now requires matching passphrases and has a Show passphrase toggle. Administrator-issued recovery codes are now implemented locally; see RECOVERY.md.

Current policy: new accounts require an invite code. Ordinary local use needs no account. See INVITATIONS.md for administrator issuance, expiry, and the fresh-install bootstrap procedure.
