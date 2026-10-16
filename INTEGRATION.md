# Full-app connection: isolated prototype

Run `node app-server.js`, then visit http://127.0.0.1:3001.

This serves a snapshot of the existing Character Chronicle app, including its existing level editor, sheet, spells, notes, and battle dashboard. It uses a **separate browser origin and SQLite file**, `character-chronicle-app-test.db`. It never reads the public app's browser storage, the Alaric backup, or the practice database.

Create a synthetic test character here. Select **Connect test saves** to enable automatic upload after the app's normal local saves. Local saves still happen first. **Load server copy** retrieves the server book; a nonempty local test book requires confirmation and receives an extra safety snapshot before replacement.

## What connects to what

- `app-preview/app.js`: the existing interface, with one extra event after a successful local save.
- `app-preview/app-sync.js`: listens for that event, then sends the entire book to the server.
- `app-server.js`: serves the interface and handles GET/PUT `/api/book`.
- SQLite `character_books`: stores the complete JSON book, revision, and update timestamp. Nested character fields are preserved without reconstructing them.

One document is deliberately used for the **single-user test** so active character, sessions, unknown extension fields, and every character property round-trip together. Separate owners/accounts and per-character records are a future design step, not implemented here.

Updates include the revision they were based on. A stale revision receives 409; the server copy is not overwritten. Pending browser changes are retained locally and retried on reconnect/focus. Conflicts require manual review, not automatic merging. An interrupted response may also require review even if the server save succeeded.

This is loopback-only and has **no accounts, remote access, periodic cross-device downloading, production deployment, or deletion/merge UI**. Do not import Alaric or expose the service publicly. Keep the original practice files for reference. GitHub Pages is unchanged. The preview disables its service worker to avoid stale test assets; online local-server access is required to open the test UI after closing it.

No dependencies need installing beyond Node.js 24. The existing `.gitignore` excludes `.db` and `.db-*` files. Both source and test assets can be committed; databases, exports, and backups must not be committed.

## Verification

Run `node integration.test.cjs` to run the isolated API/browser checks. Browser tests require Playwright (the development machine already provides it) and Microsoft Edge on Windows; alternatively supply PLAYWRIGHT_MODULE and PLAYWRIGHT_CHANNEL. The app server itself needs no third-party packages. Tests use temporary databases and synthetic records, never your real characters.

The full app snapshot is derived from combat-tracker main commit 00d238d55f77a48ea34037af7d08fcff42f85a12. This test copy is not automatically updated when the public frontend changes.

## Resume checkpoint — October 16, 2026

The user verified level 6, spent resources, a Wizard multiclass addition, notes, spellbook changes, and battle changes in a separate incognito browser after loading the server copy. Keep using synthetic characters; Alaric stays in the public app with a separate private backup. Next discussion: choose whether to add automatic retrieval/conflict UX or private accounts before remote access. Nothing is deployed to the public frontend.
