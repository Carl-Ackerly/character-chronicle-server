# Private security audit and terminal recovery

The optional-account server saves audit history in SQLite and mirrors it to `logs/security-audit.log` beside the account database. Each line is a JSON record with a UTC timestamp, account identifiers/usernames, action, and outcome. Registration, sign-in outcomes, logout, encountered session expiry, administrator grants, and recovery activity are recorded. Previously stored recovery events are exported at startup; past events that were never recorded cannot be reconstructed.

Passwords, session tokens, reset codes, character sheets, and story contents are excluded. Logs contain account metadata, so keep them private. The server does not serve this file over HTTP. `logs/` is excluded from Git. New Linux directories/files are created with owner-only permissions; Windows uses inherited folder permissions.

SQLite is the authoritative record. The file is an atomic readable snapshot, not an independent backup or tamper-proof ledger. If export fails, the database history remains and the server warns once until writing succeeds. Retention, rotation, off-machine backups, and actual Linux verification remain deployment work.

## Read recent events

PowerShell, from the server folder:

```powershell
Get-Content .\logs\security-audit.log -Tail 20
```

Linux terminal, from the server folder:

```sh
tail -n 20 logs/security-audit.log
```

## Issue a player recovery code

Verify the player's identity through a trusted private channel first. On Windows or Linux:

```sh
node account-admin.js issue-reset PLAYER_USERNAME --identity-verified
```

Replace `PLAYER_USERNAME` with the actual username. The explicit flag acknowledges identity verification; it does not perform verification itself. The command requires local access to the server files/database. It prints a one-use code expiring in 15 minutes. Share it privately with that player, who uses Reset passphrase on the homepage. Previous unused codes become invalid. Completing recovery revokes existing sessions and preserves the character book.

The code is deliberately visible in the terminal: do not record terminal transcripts or redirect command output to a shared file. The security log does not contain it. Administrator recovery uses `node account-admin.js recover-admin ADMIN_USERNAME`. Do not edit password hashes directly in SQL.

## Homepage and owner-only administration

The local port-3002 preview opens to Character Chronicle's homepage. Sign in, account creation, recovery, account copy/load actions, and administration live there. Use on this device opens local characters without an account. The book has a Home button and save status instead of the account-button strip. Both paths preserve existing browser storage keys and account ownership checks.

New web accounts always receive the member role. Administrator APIs enforce that role server-side; hiding the button is not the permission boundary. No web route grants administrator access. The owner requested postponing designation of the real sole administrator until creating the real account. Existing test roles are unchanged. Before release, explicitly designate that account, review/revoke any other administrator roles, and test the sole-owner restriction. Do not auto-promote the first registered account.

All changes remain local on the optional-accounts feature branch. No public address or public deployment is enabled; wait for the dedicated mini PC before exposing this service.
