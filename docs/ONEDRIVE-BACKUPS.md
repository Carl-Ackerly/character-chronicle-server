# Encrypted OneDrive copies

The live database stays outside OneDrive. The normal backup mechanism first creates and verifies consistent local SQLite snapshots. An optional private configuration then mirrors completed snapshots into a dedicated OneDrive folder as AES-256-GCM encrypted `.ccbackup` files. Encryption uses a random 32-byte recovery key and a fresh random 12-byte nonce per export; the format/version/key identifier are authenticated. Raw databases and the recovery key are never copied into OneDrive by this feature.

## Local setup

```sh
node account-backup-setup.js "ABSOLUTE_ONEDRIVE_FOLDER"
node account-backup.js create
```

The setup command creates `Character-Chronicle-Backups` within the selected OneDrive folder and private configuration/key/instructions under `private-admin/`. It refuses to keep the recovery key under OneDrive and does not overwrite an existing different configuration or replace a missing configured key. All private setup files are excluded from Git. Keys are stored unencrypted locally; Windows user-folder permissions apply, while new Linux files/directories use owner-only modes. This protects cloud copies, not a compromised local administrator account.

**Save the recovery key separately:** keep the full recovery-key JSON in a password manager secure note/attachment or another secure offline location. It must survive losing this PC, but must not be uploaded beside the backups. Losing every copy of the key makes the encrypted backups unrecoverable. The setup command never prints the key. Do not paste it into chat, GitHub, or terminal commands. Future key rotation would need retaining the old keys; rotation is not currently automated.

The server checks the mirror on startup and hourly while running, as well as after creating a new local snapshot. Completed older snapshots are exported too; previously failed copies retry even when a new daily snapshot is not due. Encryption and byte-for-byte decryption verification happen before copying. Only ciphertext is written to the destination, including temporary files. Existing encrypted files are verified before being reused; damaged files produce an error rather than silently replacing backup history. Local snapshots remain intact if export fails. There is no automatic deletion/retention policy yet.

`private-admin/backup-sync-status.json` reports the latest local export result; it deliberately marks `uploadVerified: false`. The app does not have OneDrive API credentials and cannot prove an upload reached Microsoft's servers. OneDrive must be signed in and running; inspect its sync status/errors and check the files through your OneDrive web account. Folder sharing is controlled in OneDrive: keep this folder unshared. Local filesystem placement does not establish remote sharing permissions.

If OneDrive is offline, absent, or read-only, no plaintext fallback is uploaded and local snapshots are retained. Export uses synchronous file IO/crypto and checks retained snapshots; review runtime and retention as databases grow. The current source snapshot is read from the local backup folder, never directly from a live database file.

## Recovery

```sh
node account-backup.js restore-cloud "ENCRYPTED_FILE.ccbackup" "RECOVERY_KEY.json" "NEW_RECOVERED.db"
```

Choose an existing private parent folder and a new destination file outside OneDrive. Authentication/decryption must succeed before plaintext is written. A private temporary database is created near the destination, verified, then restored with the existing safe workflow; the temporary file is removed afterward. Existing destination files and running databases are never overwritten. Restored sessions, password-reset codes, and unused invitations are invalidated. A separate guided cutover is still needed to use the recovered database in the running app. Encryption does not remove the need to review owner roles/password changes when restoring an old snapshot.

## Verification

Synthetic tests cover encrypted-only exports, distinct nonces, wrong keys, tampering, full database/credential/book preservation, restore invalidation of sessions/codes/invitations, refusal to overwrite, failure/retry without creating a new snapshot, private configuration loading, and recovery-key separation. Existing snapshot and invitation tests also pass. Real account data is not used for restore testing; installed real exports are checked by decrypting in memory and comparing bytes to the completed local snapshot. Actual OneDrive cloud upload requires user verification; Linux execution and off-device disaster-recovery drills remain deployment work.

## Owner key replacement
A local owner utility is available: stop the account server, then run `node account-backup-rotate.js` from the project folder, then restart the server. It takes a fresh local snapshot, validates existing cloud copies against their sources, stages a new private key, verifies all replacement ciphertext, archives retired ciphertext/key locally, activates the new key, and only then removes old-key files from the active synced folder. It never prints key values. Test it with synthetic data before adapting it to a new host. Wait for OneDrive sync and update the separate password-manager note. Cloud recycle-bin/version history and already-downloaded copies are not revoked by changing keys.
