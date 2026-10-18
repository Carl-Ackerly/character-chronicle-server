# One maintained Character Chronicle project

The combined app lives in this repository: the current character book, account UI, API, account management, synchronization, and backup tools are maintained together. The existing combat-tracker GitHub repository and GitHub Pages release are preserved as the earlier public app; they are not automatically updated by this source reorganization.

| Location | Purpose |
| --- | --- |
| `frontend/` | Canonical current browser app; edit the sheet, dashboard, spellbook, story, themes, and account UI here |
| `server/` | Canonical account/API implementation and owner backup/recovery utilities |
| `tests/` | Synthetic API/browser/security/backup tests and the suite runner |
| `docs/` | Current guides, deployment checklist, and historical learning/checkpoint notes |
| `legacy/app-preview/` | Frozen earlier single-user integration UI, retained for reference and the port-3001 learning prototype |
| Root `server.js`, `database.js`, `index.html` | Original learning exercise, retained for the owner's learning history and port-3000 command |
| Root `account-*.js` entry points | Small compatibility launchers for familiar owner commands; implementation is in `server/` |

Do not make new product changes in the legacy snapshot or the old separate public repository while developing this combined version. The legacy learning exercises remain available, but are not a second maintained production frontend.

## Private paths intentionally preserved

This change does not relocate or migrate databases, localStorage keys, browser origin/port, administrator identity, encryption keys, OneDrive configuration, snapshots, logs, or character records. The account database remains at the project root with its existing filename. `server/paths.js` resolves that root independently of the process working directory. `private-admin/`, `private-backups/`, logs, and database files remain ignored by Git.

Existing root commands still work: `node account-server.js`, `node account-admin.js ...`, `node account-backup.js ...`, `node account-invite.js create`, `node account-backup-setup.js ...`, and `node account-backup-rotate.js`. They delegate to the canonical modules. `npm start` is the normal app command. Direct server implementation commands also use the same existing private data paths.

The older `node app-server.js` command still serves its frozen single-user prototype on 3001. `node server.js` still serves the original learning exercise on 3000. Neither is exposed publicly, merged into account storage, or used as a production account service.

## Deployment and rollback

This restructuring is tested on a separate feature branch. A local pre-structure commit preserves the previous runnable layout. Preserve an independent, consistent database backup before switching code; changing source versions is not a database restore. Do not check out old/new layouts over a running server. Stop it, switch deliberately, then restart with the matching command and verify its health.

Main and the existing public frontend remain unchanged until a separately reviewed release. The combined repository can later be renamed without changing the app's private data model; a repository rename is not required for this consolidation.
