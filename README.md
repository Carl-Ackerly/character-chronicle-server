# Character Chronicle Server

A learning project for a self-hosted backend for **Character Chronicle**, a D&D character-management app with character sheets, a spellbook, combat resources, and story notes.

This repository contains the early server prototype. The existing [Character Chronicle frontend](https://github.com/Carl-Ackerly/combat-tracker) is a separate project and is **not connected to this server yet**.

## Current functionality

- Runs a local HTTP server using Node.js.
- Stores characters persistently in SQLite.
- Lists characters through `GET /characters`.
- Accepts JSON through `POST /characters`, validates basic fields, and saves a character.
- Uses parameterized SQL for inserts.
- Keeps local databases and environment files out of Git through `.gitignore`.

## Technology

- JavaScript (CommonJS)
- Node.js built-in `node:http` and `node:sqlite` modules
- SQLite and SQL
- PowerShell for testing requests
- Git and GitHub for version control

## Getting started

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

Missing or invalid fields return HTTP 400. Successful reads and inserts currently return HTTP 200.

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
| `database.js` | Database initialization and a query showing existing rows |
| `package.json` | Project metadata |
| `.gitignore` | Excludes dependencies, local databases, secrets, and logs |

The database is created locally and is not included in this repository. GitHub holds the source code; it does not run this backend or sync character data.

## Development status and limitations

This is a **local learning prototype**, not a production-ready service. It listens only on `127.0.0.1:3000` on the host computer.

Currently there is no authentication, per-player access control, cross-device syncing, update/delete endpoint, request-body size limit, or automated test suite. Unknown routes return the welcome message. Database errors in the POST handler currently share the invalid-JSON response; error handling will be refined as the server develops.

Keep the database outside folders actively synced by services such as OneDrive. For a simple manual backup, stop the server before copying the database file.

## Planned next steps

- Build a browser form for adding characters.
- Improve request handling and error responses.
- Add meaningful automated API tests.
- Expand the SQL schema for complete character data.
- Add private player accounts and access controls.
- Connect the existing frontend.
- Implement offline-aware cross-device synchronization and conflict handling.
- Explore private remote access and Docker deployment.

## Learning focus

Built step by step to practice JavaScript, HTTP methods, JSON, SQL table design, parameterized queries, persistence, debugging, and version control.
