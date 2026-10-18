# Character Chronicle

A D&D character book with character sheets, a spellbook, combat resource tracking, story notes, themes, and optional accounts for invited players. This repository now maintains the browser app and its self-hosted Node.js/SQLite backend together.

The [earlier public app](https://carl-ackerly.github.io/combat-tracker/) and [its repository](https://github.com/Carl-Ackerly/combat-tracker) remain available. They are not automatically updated by this combined project's feature branches.

## Run locally

Use Node.js 24 or later (verified with Node.js 24 on Windows). The server itself uses Node built-ins and has no production package dependencies.

```sh
npm start
```

Open http://127.0.0.1:3002/. The familiar `node account-server.js` command also works. The app remains loopback-only: this is a development preview, not a public deployment. HTTPS access and the dedicated Linux host still need to be configured.

- Anyone can choose **Use on this device** without an account. Those characters stay in that browser.
- New accounts require an administrator-issued, one-use invitation. Members sign in to access their own account books.
- Account changes save locally first, then sync when connected. Clean copies check for updates automatically; conflicting books are preserved for review.
- Administrator-assisted recovery and signed-in passphrase changes preserve character books and revoke affected sessions.
- Consistent local backups and optional encrypted OneDrive copies support separate-file recovery. Private owner notes, keys, databases, logs, and backups never belong in Git.

See [the current release checklist](docs/RELEASE-CHECKLIST.md) for completed functionality, remaining limitations, and deployment work. A passing test suite is not a substitute for the remaining release/security review.

## Project layout

| Folder | What to edit |
| --- | --- |
| `frontend/` | Current character book, dashboard, spellbook, story, themes, and account UI |
| `server/` | Account APIs, recovery, invitations, audit logging, and backup implementation |
| `tests/` | Isolated synthetic API/browser/backup tests |
| `docs/` | Setup, operation, recovery, and deployment guides |
| `legacy/app-preview/` | Frozen earlier single-user UI retained for the learning prototype |

Root `account-*.js` files are compatibility launchers, not duplicate implementations. See [PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md). The original learning exercise remains at the root for reference.

## Existing data stays where it is

The source reorganization does not move the existing account database, private configuration, administrator identity, recovery keys, logs, or snapshots. Private paths remain at the project root and outside OneDrive. The browser address/storage keys are preserved. Never overwrite or commit these files while updating source.

A fresh clone intentionally contains no actual users or characters. Start the account server once, create a private invitation with `node account-invite.js create`, register the owner, then explicitly grant that account administrator access with the local owner command. Normal registration never grants administrator status. Follow [INVITATIONS.md](docs/INVITATIONS.md) and [RECOVERY.md](docs/RECOVERY.md); do not repeat bootstrap against an existing configured database.

## Test

Install the pinned development-only browser test dependency:

```sh
npm ci
```

Windows browser tests use installed Microsoft Edge. For Linux, install the test browser first:

```sh
npx playwright install chromium
```

Then run:

```sh
npm test
```

Tests create disposable synthetic databases/browser contexts rather than opening the real account database or reading recovery keys. They cover full book persistence, account isolation, invitation/recovery abuse, passphrase changes, sessions, stale writes, automatic sync/conflicts, backups/restore, encrypted exports/key rotation, responsive UI, and theme contrast. Actual Linux hosting/phone connectivity, CI automation, and a final release review remain outstanding.

## Owner commands

Existing root commands are preserved:

```sh
node account-admin.js grant-admin USERNAME
node account-admin.js issue-reset USERNAME --identity-verified
node account-admin.js recover-admin ADMIN_USERNAME
node account-invite.js create
node account-backup.js create
```

Administrator grants require local server filesystem access and are not web endpoints. Private reset/invitation codes can appear in owner terminal output; do not put them in chat, Git, or transcripts. Verify requester identity before recovery. See the guides below before using restore, OneDrive setup, or key replacement commands.

## Guides

- [Accounts](docs/ACCOUNTS.md), [invitations](docs/INVITATIONS.md), [account recovery](docs/RECOVERY.md), [passphrase changes](docs/PASSPHRASE-CHANGES.md)
- [Automatic synchronization](docs/SYNC.md), [database backups and restore](docs/BACKUPS.md), [encrypted OneDrive copies](docs/ONEDRIVE-BACKUPS.md), [security audit logs](docs/LOGGING.md)
- [Release checklist](docs/RELEASE-CHECKLIST.md), [roadmap and checkpoints](docs/ROADMAP.md), [structure and rollback](docs/PROJECT-STRUCTURE.md)
- [Learning history](docs/LEARNING-HISTORY.md), [earlier single-user integration](docs/INTEGRATION.md)

## Preserved learning commands

`node server.js` still runs the original learning form/API on port 3000. `node app-server.js` still runs the earlier single-user integration prototype on port 3001 using the frozen legacy UI. Their separate database files are preserved. These unauthenticated learning prototypes are not the account app and must not be exposed publicly.

## Rules and attribution

The frontend retains its existing rules/source notices and SRD attribution. It remains an evolving 2024-rules aid; do not interpret source consolidation as certification that every Player's Handbook rule is complete or verified. The previous public release remains available until a separately reviewed cutover.
