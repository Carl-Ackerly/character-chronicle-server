# Earlier project README (historical)

This preserves the learning project narrative from before source consolidation. See the root README and PROJECT-STRUCTURE.md for current paths and commands.

# Character Chronicle Server

A learning project for a self-hosted backend for **Character Chronicle**, a D&D character-management app with character sheets, a spellbook, combat resources, and story notes.

This repository contains the original learning server, a full-app integration prototype, and the optional-account Character Chronicle preview. A snapshot of the existing [Character Chronicle frontend](https://github.com/Carl-Ackerly/combat-tracker) connects to SQLite locally on port 3001. The public GitHub Pages app remains separate and unchanged.

## Optional accounts and recovery — local preview

Run `node account-server.js` and open http://127.0.0.1:3002. This separate, local-only preview adds optional accounts, private books, and administrator-assisted one-use reset codes. The public app is unchanged. See [ACCOUNTS.md](ACCOUNTS.md), [RECOVERY.md](RECOVERY.md), and [ROADMAP.md](ROADMAP.md). Use test credentials; HTTPS/public deployment is not enabled.

## Full-app integration prototype

Run:

```powershell
node app-server.js
```

Open http://127.0.0.1:3001. Create a separate test character and select **Connect test saves**. The existing character sheet, spellbook, notes, and battle dashboard save the complete book locally first, then upload it to a separate SQLite database. In a fresh browser session, select **Load server copy** to retrieve it. Downloading newer changes is manual; this is not yet multi-user cloud syncing.

- Full nested JSON is preserved, including custom fields and saved sessions.
- Revision checks reject stale writes rather than silently overwriting a newer copy.
- Pending changes remain local during connection failures.
- No login, remote access, or public deployment is implemented.
- No real character records, databases, or backup exports are included in Git.

See [INTEGRATION.md](INTEGRATION.md) for architecture, limitations, and isolated test instructions. The `app-preview/` snapshot comes from the existing frontend; it is not a second independently designed UI.

## Server modes

| Command | Address | Purpose |
| --- | --- | --- |
| `node account-server.js` | http://127.0.0.1:3002 | Optional accounts, automatic sync, recovery, settings, and backups |
| `node server.js` | http://127.0.0.1:3000 | Original learning form and GET/POST/PATCH character routes |
| `node app-server.js` | http://127.0.0.1:3001 | Existing full app connected to a separate test-book database |

All three modes bind to loopback only and use different database files. Stop a foreground server with Ctrl+C.

## Learning server functionality

- Runs a local HTTP server using Node.js.
- Serves a browser form for adding characters, with a saved-character list that refreshes after successful saves.
- Stores characters persistently in SQLite.
- Lists characters through `GET /characters`.
- Accepts JSON through `POST /characters`, validates basic fields, and saves a character.
- Updates a character level through `PATCH /characters/:id`, with existence and level checks.
- Uses parameterized SQL for inserts and updates.
- Keeps local databases and environment files out of Git through `.gitignore`.

## Technology

- JavaScript (CommonJS)
- Node.js built-in `node:http` and `node:sqlite` modules
- SQLite and SQL
- PowerShell for testing requests
- Git and GitHub for version control

## Getting started with the learning server

Use **Node.js 24 LTS**. The project currently has no external dependencies, so no `npm install` step is needed. Node may print an experimental warning for its SQLite module.

Clone the repository and enter the folder:

```powershell
git clone https://github.com/Carl-Ackerly/character-chronicle-server.git
cd character-chronicle-server
```

Initialize the database **before starting the server**:

```powershell
node database.js
```

This creates `character-chronicle.db` beside the source files, creates the table if needed, and prints existing rows. It does not insert sample characters or erase existing rows.

Start the server:

```powershell
node server.js
```

Open [http://127.0.0.1:3000/characters](http://127.0.0.1:3000/characters) to view saved characters. A new database returns `[]`.

Keep the terminal running while using the server. Press **Ctrl+C** to stop it. Restart after editing and saving server code.

## Try the API

### Read characters

In a second PowerShell terminal:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/characters" -Method Get
```

### Add a character

```powershell
$character = @{
    name = "Practice Hero"
    level = 2
    max_hp = 18
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3000/characters" -Method Post -ContentType "application/json" -Body $character
```

A successful request returns:

```json
{ "message": "Character saved" }
```

Refresh the characters page to see the new row. **Each successful POST creates another character**, including repeated submissions of the same values.

| Field | Requirement |
| --- | --- |
| `name` | Nonempty string; surrounding whitespace is removed |
| `level` | Integer from 1 to 20 |
| `max_hp` | Positive integer |

Missing or invalid fields return HTTP 400. Successful reads return HTTP 200; inserts return HTTP 201 Created.

## Database structure

The initial `characters` table contains:

```sql
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  max_hp INTEGER NOT NULL DEFAULT 10
);
```

SQLite assigns an ID when a row is inserted without one. This is a starter schema; accounts, full character records, spell selections, and battle state are not implemented yet.

## Project files

| File | Purpose |
| --- | --- |
| `server.js` | HTTP request handling, validation, and character reads/inserts |
| `index.html` | Character form, POST submission, and automatically refreshed saved-character list |
| `database.js` | Database initialization and a query showing existing rows |
| `package.json` | Project metadata |
| `.gitignore` | Excludes dependencies, local databases, secrets, and logs |

The database is created locally and is not included in this repository. GitHub holds the source code; it does not run this backend or sync character data.

## Development status and limitations

This is a **local learning prototype**, not a production-ready service. It listens only on `127.0.0.1:3000` on the host computer.

The learning server has no authentication, per-player access control, cross-device syncing, delete endpoint, request-body size limit, or automated test suite of its own. The full-app prototype has separate isolated integration tests. Unknown routes return HTTP 404. Malformed JSON returns HTTP 400; other POST exceptions return HTTP 500. Further error handling will be refined as the server develops.

Keep the database outside folders actively synced by services such as OneDrive. For a simple manual backup, stop the server before copying the database file.

## Planned next steps

- Improve request handling and error responses.
- Add meaningful automated API tests.
- Expand the SQL schema for complete character data.
- Add private player accounts and access controls.
- Refine the existing frontend connection beyond the isolated prototype.
- Implement offline-aware cross-device synchronization and conflict handling.
- Explore private remote access and Docker deployment.

## Learning focus

Built step by step to practice JavaScript, HTTP methods, JSON, SQL table design, parameterized queries, persistence, debugging, and version control.


## Verified checkpoint — October 16, 2026

Manual testing confirmed that a synthetic multiclass Fighter/Wizard character, level changes, spent Second Wind uses, notes/story entries, spellbook selections, and dashboard changes reload in a separate incognito browser via Load server copy. Automated checks cover SQLite restart persistence, nested JSON preservation, invalid requests, stale-revision rejection, local saves during outages, reconnection, asset restrictions, and responsive widths.


## Current account-preview checkpoint
The account preview includes automatic syncing and whole-book conflict recovery, administrator-assisted reset codes, signed-in passphrase changes, private security audit logs, and consistent daily backups with separate-file restore tests. These features belong to port 3002; the older port-3001 prototype still has its earlier limitations. See [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) for current status, setup/test instructions, remaining deployment work, and the decision to keep registration open. Run the regression suite with `npm test`. Private account records, databases, logs, and backups are excluded from Git. Public hosting is not enabled.

Account-creation policy update: accounts now require administrator-issued one-use invitations; device-only use remains available without an account. Existing accounts keep their data and access. See [INVITATIONS.md](INVITATIONS.md). This supersedes the earlier open-registration decision.
