# Automatic account backups and tested restore

The port-3002 account server now creates consistent SQLite snapshots in `private-backups/` beside its database. It checks at startup and once an hour, creating a backup when at least 24 hours have elapsed since the latest verified snapshot for that database path. If the computer/server is off, it cannot take backups; it checks again on startup. A first backup is created immediately when none exists.

Snapshots include accounts, password hashes, administrator roles, complete character books and revisions, and security audit history. SQLite `VACUUM INTO` produces a consistent snapshot while the server is running. Integrity and relationship checks must pass before the temporary file becomes a completed backup. A failed backup retains live data and earlier backups and writes a generic server warning.

Backups are private database files, excluded from Git and inaccessible through the web server. Linux files/directories are created owner-only; Windows uses user-directory permissions. Backups are not encrypted. Keep them away from shared folders. This folder is on the same disk as the app, so it protects against some application mistakes but not loss of that disk. Off-device copies and monitoring still need to be configured before release.

There is no automatic deletion/retention policy yet: earlier backups are retained. Monitor available disk space. Snapshot history can grow with account data. Backup generation is synchronous and may briefly pause requests for a large database; review performance before expanding the user group.

## Manual backup (Windows or Linux)

From the server project folder:

```sh
node account-backup.js create
```

This prints only the verified backup file path, never account contents or passwords. Copy completed `.sqlite` files to private off-device storage. Do not copy an actively written database as your backup method.

## Restore safely to a separate file

```sh
node account-backup.js restore "FULL_PATH_TO_BACKUP.sqlite" "FULL_PATH_TO_NEW_RECOVERED.db"
```

Replace both paths. The destination must not already exist. Corrupt/incomplete input is rejected. Neither the running database nor its backup is overwritten. Failure leaves any incomplete destination for inspection; do not use a file from a failed restore.

The recovered database keeps password hashes, accounts, administrator roles, books, and revisions, but invalidates all restored login sessions and outstanding recovery codes. Users must sign in again. Old resets must be reissued. Restoration adds a security audit event. It cannot undo a credential change made after the snapshot; verify ownership and recovery needs before reopening the restored system.

Before switching live databases: stop the account server, make a fresh backup of the current database, verify the recovered copy separately, preserve the current file for rollback, and perform a deliberate offline cutover. A new database filename is not automatically used by the default server. The current server's default file remains `character-chronicle-accounts-test.db`. Do not replace a live file or its SQLite sidecars. Request a guided cutover when needed; the restore command intentionally does not perform one.

## Verification performed

Synthetic tests round-trip full nested character data, spells, notes, resources, sessions, unknown fields, account credentials, and administrator roles. They verify daily/restart eligibility, invalid/corrupt backup rejection, refusal to overwrite live/existing files, preservation on storage failure, old-session rejection, reset-code invalidation, and successful sign-in and book retrieval from a separate restored server. Real characters and the owner's account were not used for restore testing. Actual Linux execution and disaster recovery on the eventual dedicated host remain pending.

Invitation update: snapshots also include account_invitations; the restore utility invalidates outstanding invitations alongside sessions and reset codes.
