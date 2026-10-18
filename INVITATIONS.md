# Invited accounts, local use for everyone

The account server now defaults to invitation-only registration. Existing accounts, password hashes, roles, and character books remain unchanged. Anyone who can reach the app can choose Use on this device without an invitation or account; those characters remain in that browser and are not synced to your server.

## Invite a friend

1. Sign into the administrator account.
2. Open Account administration, then Invite a player.
3. Verify with your administrator passphrase.
4. Copy the one-use code and share it privately with that person.
5. They open Create test account on the sign-in page, paste the invite code, and choose their own username/passphrase.

Invitations expire after seven days and can create one ordinary member account. They never grant administrator permissions. A code is a bearer credential: anyone who receives it could use it, so do not post it publicly. The server stores a SHA-256 hash, issuer, expiry, and redemption metadata, never the raw code. The audit log records issuance/acceptance without codes or passphrases.

Account creation and claiming the invitation are one transaction, rechecked after password hashing. Concurrent attempts cannot both use a code; invalid data or duplicate usernames do not consume it. Expired, missing, and used codes are rejected by the server, not just the form. Administrator issuance requires role authorization, CSRF validation, current-passphrase verification, and the existing administrator request limits. Invitation revocation/listing UI is not yet implemented; unused codes expire automatically.

## Local owner bootstrap or terminal use

From the server folder on Windows or Linux:

```sh
node account-invite.js create
```

This requires local server filesystem access and prints a private seven-day invitation. Do not record the output in transcripts, Git, or chat. Start the account server once before using it so the database exists. On a fresh installation, the owner can create an invitation this way, register their own account, then explicitly grant that account administration with the existing local owner command. No web user becomes administrator automatically. The existing owner's setup does not need to be repeated.

Restoring a database using account-backup.js invalidates outstanding invitations, sessions, and password-reset codes; create fresh invitations afterward. Whole-database backups include the invitation table. No existing account needs to register again.

## Verification and deployment limits

Synthetic tests cover default rejection without invitations, expiration/replay, concurrent redemption, administrator checks, duplicate-name retention, preserved existing accounts, guest local use, invited signup, ordinary roles, and secret-free audit. Existing account tests explicitly opt their disposable fixtures into open registration solely to create test users; the normal command-line server does not expose an open-registration switch to web clients.

This change does not create a public address. Keep the service local until secure hosting is ready. Friends need access to the eventual host to sync; local-only mode does not imply their data reaches this server. The existing GitHub Pages app remains separate.
