# Character Chronicle

A personal D&D character book: character sheets, spell preparation, battle resources, story notes, and selectable themes. The project combines a browser interface with a self-hosted Node.js and SQLite account server.

## Open the app

### [Open Character Chronicle — account sign-in](https://siege.tailb9139f.ts.net)

**Currently private:** the link requires Tailscale on an approved device. The host computer must be awake with the account server running. Opening this public README does not grant network access or an app account. New accounts require a one-use invitation from the administrator.

Sign into the same Character Chronicle account on your phone and computer to access the same saved character book. Tailscale sign-in and Character Chronicle sign-in are separate.

**[Older public app — local saves only](https://carl-ackerly.github.io/combat-tracker/)** remains available as a fallback without Tailscale. Its browser saves are separate from account saves; they are not automatically imported into an account.

## What it does

- Character sheets with class choices, feats, equipment, currency, and calculated statistics.
- Spellbooks with prepared spells, spell details, and custom spells.
- Battle dashboards for hit points, spell slots, and class resources.
- Dated story notes and selectable visual themes.
- Optional invited accounts with automatic book synchronization and conflict review.
- Administrator-assisted password recovery, private audit logs, consistent database backups, and encrypted backup copies.

Character data is stored on the host server and cached in the browser. GitHub stores source code, not player accounts or character books. Device-only mode stores characters in that browser and does not synchronize them.

## Source and development status

The current combined frontend/backend implementation is maintained on the [private-device-access branch](https://github.com/Carl-Ackerly/character-chronicle-server/tree/feature/private-device-access). The default branch still retains the original learning checkpoint; this README points to the current work without merging application code or deploying it publicly.

The account server uses Node.js 24 and SQLite through Node's built-in modules. The frontend uses HTML, CSS, and JavaScript. Production server code has no external package dependencies; browser tests use Playwright.

On the current implementation branch, start the account app with:

```sh
npm start
```

Open http://127.0.0.1:3002/ on the server computer. A fresh clone contains no users, characters, passwords, recovery keys, or private access settings. Follow the [current setup guide](https://github.com/Carl-Ackerly/character-chronicle-server/tree/feature/private-device-access#run-locally) before creating a new installation. Do not replace an existing account database while updating source.

## Verification and remaining work

Automated synthetic tests cover account isolation, invitations, password recovery, session security, complete character-book persistence, sync conflicts, backups and restore, encrypted exports, private HTTPS request checks, responsive layouts, and theme contrast. The owner has confirmed private phone sign-in and automatic account-book loading.

Before public release: configure the dedicated Linux mini PC and automatic startup, select the permanent HTTPS address, test Linux deployment and recovery, review privacy and rules/content licensing, and complete the security review. This is a private side project under development, not a claim of complete rules coverage or production certification.

See the current branch's [release checklist](https://github.com/Carl-Ackerly/character-chronicle-server/tree/feature/private-device-access/docs/RELEASE-CHECKLIST.md), [project structure](https://github.com/Carl-Ackerly/character-chronicle-server/tree/feature/private-device-access/docs/PROJECT-STRUCTURE.md), and [private access guide](https://github.com/Carl-Ackerly/character-chronicle-server/tree/feature/private-device-access/docs/PRIVATE-ACCESS.md).

## Project history

This began as a JavaScript/HTTP/SQL learning server and grew into Character Chronicle. The original form/API and integration prototype remain available in source for reference. The [earlier frontend repository](https://github.com/Carl-Ackerly/combat-tracker) continues to host the public device-only version.

Private databases, backups, recovery material, and logs must never be committed. Keep existing data backed up before migration or updates.
