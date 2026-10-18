# Character Chronicle — path to a private release

Updated October 17, 2026.

## What “finished” means for the first release

A small invited group can open one HTTPS link on a phone or PC, use the character book without an account, or sign in to access their own characters. The existing sheet, spells, combat dashboard, themes, and story pages remain intact. Offline changes stay safe, accounts are isolated, recovery works, and backups can actually be restored.

This is the first-release target, not a claim that those features are all complete. Remote hosting, account recovery, repository consolidation, and production security review remain outstanding. Docker, a NAS, payments, app-store distribution, and a custom domain are not prerequisites.

## Completed checkpoints

- [x] Public character book with sheets, spellbook, battle resources, notes/story, themes, and device-local saving.
- [x] Downloadable complete character-book JSON backup.
- [x] Alaric backup downloaded and confirmed by the owner, stored privately outside the server project. Do not use it for testing or commit it.
- [x] Learning server on port 3000: GET/POST/PATCH, SQL persistence, validation, browser form, and basic HTTP errors.
- [x] Separate full-app single-user prototype on port 3001, with local-first complete-book storage and revision checks.
- [x] Manual test across regular/incognito sessions: level, multiclass Wizard addition, spellbook, story notes, and battle resources persisted.
- [x] Optional-account prototype on port 3002, with a separate database and existing frontend controls.
- [x] Per-account server book ownership, separate local account/guest copies, explicit copying into an empty account, login, logout, session expiry, password hashing, and session rotation.
- [x] CSRF/custom-header/origin checks, loopback Host allowlist, rate limits, request-size limits, and restricted static assets.
- [x] Automated synthetic tests for account isolation, stale tabs, conflicts, guest preservation, offline pending changes, and responsive UI.
- [x] Manual same-account loading in incognito and second-account separation confirmed by the owner.
- [x] Create-account passphrase confirmation and Show passphrase controls (local preview; refresh to load).

The optional-account branch is local and uncommitted at this checkpoint. The earlier full-app prototype is already on GitHub. Do not describe the accounts as published or production-ready until they are reviewed and released.

## 1. Finish account usability and recovery

- [x] Choose administrator-assisted one-use codes: players contact the owner, who verifies identity and privately provides a code.
- [x] Implement administrator-issued recovery with generic invalid/expired code responses; a username alone cannot reset credentials.
- [x] Generate strong recovery tokens, store only token hashes, expire them, allow one use, and rate-limit requests and attempts.
- [x] Select manual private delivery for this stage; no email service or mail credentials are configured. Automated delivery remains future work.
- [x] Require password confirmation on reset, apply the password policy, and revoke existing sessions after a completed reset.
- [x] Add authenticated password change that requires the current password and rotates/revokes sessions appropriately.
- [x] Add an explicit administrator role for the owner, enforced server-side; normal accounts cannot grant themselves admin access.
- [x] Provide an admin recovery screen with minimal account information (username, recovery contact if configured, account status), never plaintext passwords or automatic access to character contents.
- [x] Require recent administrator reauthentication to initiate a reset and verify the requester through a trusted channel. Record the verification procedure for this small invited group.
- [x] Generate a short-lived, single-use reset link/code so the account holder chooses a new passphrase. Store only its hash, rate-limit redemption, avoid logging the secret, and deliver it through a verified channel.
- [x] Preserve all character books during recovery; password resets must never recreate/delete the account or its records. Revoke old sessions after successful reset and notify the account holder through the configured trusted channel.
- [x] Audit recovery initiation and completion with administrator ID, target account ID, outcome, and timestamp, without passwords/tokens/private character data. Test unauthorized admin calls, expired/replayed tokens, impersonation attempts, and preservation of the full book.
- [x] Document how the owner recovers administrator access if their own credentials are lost; keep that controlled procedure separate from normal player recovery.
- [ ] Decide invitation-only enrollment for the intended friends-only release; do not expose unrestricted registration accidentally.
- [ ] Improve expired-session messaging and preserve pending local changes while the player signs in again.
- [ ] Consider common/breached-passphrase screening and MFA/passkeys after choosing the identity approach. Do not claim these are currently implemented.

**Acceptance:** A user can recover their own account, an expired/used token fails, others cannot reset it, and reset/change invalidates older sessions without erasing characters.

## 2. Complete synchronization and data safety

- [ ] Define the final ownership model: keep one complete JSON book per account initially, or move to per-character records with stable IDs and tested migrations. Avoid dropping unknown/custom fields.
- [ ] Add consistent automatic retrieval while an app is open, not just initial load/focus/reconnect. Choose polling or a server notification mechanism.
- [ ] Finish clear states for saving, saved, offline, signed out, conflict, and failed upload.
- [ ] Add conflict review that lets users retain both versions or choose one after a backup. Never silently overwrite a dirty local copy.
- [ ] Handle uncertain outcomes when a server save succeeds but its response is lost; reconcile or use idempotent operations rather than guessing.
- [ ] Test simultaneous edits from two devices, multiple tabs, account switches, session expiry during a save, offline edits, and reconnects.
- [ ] Add import/restore with schema validation, a preview of characters, and explicit duplicate/replacement choices. Export exists; a user-facing restore flow does not yet.
- [ ] Extend device-to-account upload to safe merging of populated books, if needed. The prototype only copies into an empty account.
- [ ] Add a shared-device policy and optional clearing of cached account data on logout, with protection for unsynced changes. Current cached copies are unencrypted browser storage on a trusted device.
- [ ] Add explicit schema versions and migrations with rollback backups and round-trip tests for every stored field.

**Acceptance:** All character data—including prepared spells, feats, equipment, XP, story entries, sessions, and spent resources—survives restart and cross-device changes. Conflicts and failures never silently discard data.

## 3. Combine the GitHub project cleanly

- [ ] Choose the canonical Character Chronicle repository and folder structure, such as `frontend/`, `server/`, `tests/`, and `docs/`.
- [ ] Consolidate the source without losing commit history or the current working releases. Preserve the old repositories until the new setup is verified.
- [ ] Replace copied preview snapshots with one maintained frontend source and documented build/serve steps. Avoid three drifting copies of the interface.
- [ ] Preserve rules attribution, licensing notices, themes, and existing functionality.
- [ ] Provide clear run commands, environment examples without secrets, and a clean-install walkthrough.
- [ ] Set up GitHub Actions for API, account-isolation, and frontend integration tests using disposable databases.
- [ ] Update the README with screenshots, frontend/backend architecture, actual completed features, limitations, and a working app link.
- [ ] Pin the project on the GitHub profile for the résumé. Keep project claims aligned with implementation and the owner's contributions.

**Acceptance:** A fresh clone can be installed, tested, and started using the README; one source controls the app; private records/secrets never enter Git.

## 4. Build dependable backups and operations

- [ ] Add automatic SQLite backups using a consistent snapshot method, or a controlled stopped-server backup. Do not casually copy a live database without accounting for journaling.
- [ ] Set retention and keep an additional backup outside the mini PC. A folder on the same disk alone does not protect against disk failure.
- [ ] Encrypt/protect private backups and restrict file-system access. The accounts database contains character data, password hashes, and session metadata.
- [ ] Perform a restore drill into a separate database and verify full records and account ownership.
- [ ] Add safe logs without passwords, tokens, reset links, or complete private character payloads; configure retention.
- [ ] Configure a controlled background service/startup task, graceful shutdown, and clear stop/restart instructions.
- [ ] Decide operating hours and Windows sleep/update behavior; document that syncing is unavailable while the host is offline.
- [ ] Document dependency/runtime patching, rollback, session invalidation, and what to do if the host or database is compromised.

**Acceptance:** Backups restore successfully, a reboot has a predictable outcome, and no private information is exposed through logs or repository files.

## 5. Choose and configure remote access

This decision was deliberately deferred. The mini PC can host the server; buying a NAS or renting a server is optional. A custom domain is also optional depending on the access service.

- [ ] Compare private VPN access against a public HTTPS tunnel/reverse proxy, including current cost, address stability, access controls, and maintenance.
- [ ] Prefer one HTTPS origin for frontend and API where practical, avoiding unnecessary cross-origin session-cookie complexity.
- [ ] If keeping GitHub Pages separate, design and test the exact API origin/CORS/CSRF/cookie policy before changing the current same-origin protections.
- [ ] Configure HTTPS, Secure cookies, trusted proxy settings, allowed Host/Origin values, and safe forwarding-header handling.
- [ ] Expose only the application endpoint—not SQLite files, source secrets, mini-PC administration, or unrelated NAS shares.
- [ ] Tune rate limits for the real topology and trusted client IP source; do not trust arbitrary forwarded IP headers.
- [ ] Test from a phone on cellular data and another PC outside the home network, including unavailable-host behavior.

**Acceptance:** Invited players can reach the app through the chosen method, authenticated traffic is encrypted, and unintended services/data are unreachable.

## 6. Final security and usability review

- [ ] Review account and API authorization on every data route, including future import, export, delete, session, and recovery routes.
- [ ] Re-test unauthorized reads/writes, stale sessions, fixation, logout, recovery abuse, CSRF, Origin/Host rules, injection, stored XSS, body limits, and resource-exhaustion behavior.
- [ ] Review all UI rendering of player-created spells, notes, equipment, and imported data; treat it as untrusted text.
- [ ] Remove or lock down test endpoints, sample accounts, debug output, and obsolete unauthenticated prototypes before any remote release.
- [ ] Verify frontend caches never store authenticated API responses or leak one account's data to another. Complete a deliberate offline/PWA strategy; the current account preview has no service worker.
- [ ] Check iPhone Safari and desktop browsers, keyboard/accessibility, narrow-screen dialogs, password-manager behavior, and errors that preserve form input.
- [ ] Review dependencies and deployment configuration; obtain an independent review where possible. Passing tests is not a guarantee of perfect security.

**Acceptance:** The identified risks are reviewed and resolved or explicitly accepted, and the complete account/data lifecycle works on the target devices.

## 7. Controlled release to invited friends

- [ ] Tag a known-good version and preserve a tested rollback path.
- [ ] Keep the existing public app available until the new version is verified.
- [ ] Provide a migration guide: back up local characters, sign in, explicitly upload/copy, verify server data from a second device, retain the original backup.
- [ ] Do not move Alaric automatically. Any migration of that record requires an explicit decision and a fresh verified backup.
- [ ] Trial with a small invited group; collect issues and monitor sync errors without recording private payloads.
- [ ] Document data ownership, account recovery, host availability, backup practices, and how users export/leave.

**Acceptance:** Friends can safely sign in, recover access, play offline within the documented limits, sync later, and restore/export their own data.

## Dedicated Linux mini PC — planned hosting direction

The owner plans to consider a separate mini PC running Linux for server use. Development continues on the current Windows PC; buying new hardware or migrating now is not required.

- [ ] Select a supported Linux distribution and document Node.js installation and updates.
- [ ] Keep application paths portable, use environment-based configuration, and document differences between Windows and Linux startup.
- [ ] Migrate the code and a consistent database backup to the Linux host without committing databases, secrets, or character exports to GitHub.
- [ ] Use a dedicated unprivileged service account, restricted database/backup permissions, and a managed background service such as systemd.
- [ ] Test login, logout, account ownership, recovery, complete character persistence, syncing, backups, and restore on Linux before switching users over.
- [ ] Arrange a final consistent backup and controlled cutover so the old and new hosts do not accept competing writes. Keep a tested rollback copy.
- [ ] Provide an administrator web page for approved recovery tasks. Linux terminal access handles server maintenance; player password resets use the controlled recovery workflow, not ad hoc database edits.
- [ ] Document secure remote administration, firewall rules, updates, service health/logs, and administrator-access recovery.
- [ ] Use this work to learn Linux permissions, services, backups, and deployment. Add Docker packaging later if desired; preserve database data outside disposable containers.

This migration does not itself provide secure internet access. HTTPS/VPN/tunnel decisions, trusted-proxy settings, and release security checks still apply. User passwords remain hashed; neither Linux administration nor the admin page should expose original passwords.
## Later optional improvements

Docker packaging, a NAS move, custom domain, passkeys/MFA, richer sharing, campaign collaboration, and more advanced database normalization can follow a stable private release. They should not delay the essential account, safety, and recovery work above.

## Next session

1. Refresh the port-3002 preview and check the confirmation/visibility controls.
2. Review this roadmap and choose the account recovery mechanism.
3. Commit the verified account prototype on its feature branch when authorized; do not publish it to the live app yet.



## Recovery checkpoint — October 17, 2026

Local administrator-assisted recovery is implemented and tested. See RECOVERY.md for the owner setup command and private-code workflow. No actual account has been promoted automatically. A consistent backup of the test account database was made outside Git before upgrading, and stored book data/revisions were verified unchanged afterward. Existing public app and Alaric remain separate. Passphrase changes while already signed in, automated notifications/email delivery, remote hosting, and public release are still outstanding. Next: the owner chooses their test admin username and tests issuing/redeeming a code with a second test account.

Password-policy preference (October 17): owner requested an eight-character minimum for the local prototype. Creation, login, administrator reauthentication, and reset use the same minimum, and tests verify eight accepted/seven rejected. Existing password hashes are unchanged. Review the single-factor password policy again before any public deployment; the shorter minimum does not provide the same guessing resistance as the earlier 15-character recommendation.

## Logging and homepage checkpoint — October 17, 2026

Private audit-file snapshots and terminal player recovery are implemented. See LOGGING.md for Windows/Linux commands, privacy limits, and operating notes. SQLite remains authoritative; logs/ is excluded from Git. Log retention/rotation and Linux deployment verification remain pending.

The port-3002 prototype now opens to a Character Chronicle homepage with local use, sign-in, account creation, and recovery. Account administration and copy/load tools live on the homepage; character pages have Home navigation and save status. Local storage keys, account books, and existing test roles are preserved.

Owner decision: defer selection of the real sole administrator until the real account is created. Before release, explicitly designate that account, review/revoke all other admin roles, and test server-side sole-owner enforcement. Ordinary web registration must never promote an administrator. Do not automatically assign any existing test account as the production owner.

No public address or internet exposure until the dedicated mini PC is ready. Current preview remains loopback-only. Next: review the homepage, then complete the remaining sync/conflict, backup/restore, account lifecycle, and deployment checks before release.

Homepage refinement: username/passphrase inputs are directly on the homepage, reset is inside the sign-in form, and local use is a separate main option. Inline login, recovery, account creation, ownership isolation, sync, and responsive layout checks passed with synthetic accounts. No database or administrator roles changed.

Successful sign-in now opens the saved-character book directly. Homepage buttons share the primary theme color (red in Current Handbook); reset remains compact. Account, recovery, and homepage regression checks passed.

Signed-in accounts now bypass the extra account homepage, including revisiting #home. Normal player navigation shows Sign out and save status. Administrator access stays role-restricted. Import controls appear only for an empty account with local characters; load-copy recovery appears only on a sync conflict. No data or account permissions changed. Regression tests passed.

Owner administrator designated October 17: chosen owner account is now the sole database administrator; prior test administrator demoted. A consistent private database backup was saved, affected sessions and unused reset codes revoked, and character books/password hashes verified unchanged. Private owner record updated in the Git-ignored private-admin folder. Preserve this database/account through production migration.

## Automatic backup checkpoint — October 17, 2026
Daily consistent account-database snapshots now run in the local account server, checked at startup and hourly. The first verified private snapshot was created. Synthetic restore tests preserve credentials, sole-owner role, and full nested books; restored sessions/reset codes are invalidated. Restores target new files only and never automatically replace the running database. Account/recovery regression tests passed; existing real books and revisions were verified unchanged after installation. See BACKUPS.md. Off-device backups, retention/rotation, failure monitoring, actual Linux verification, and a guided live cutover drill remain outstanding. Next: improve multi-device conflict handling and uncertain-save recovery.

## Automatic synchronization checkpoint — October 17, 2026
Visible pages check automatically every 15 seconds, on focus, and on reconnect; clean copies refresh while typing/dialogs are protected. Pending save metadata handles committed saves with lost responses. Whole-book conflict review retains both versions privately and offers explicit device/server choices with revision checks. Expired sessions offer sign-in again while preserving pending changes. Synthetic two-browser tests passed for automatic refresh, offline conflicts, both choices, lost-response recovery, and reauthentication. Account/recovery regressions passed. See SYNC.md for remaining phone/host checks, same-browser multi-tab testing, cache policy, and recovery-bundle import work. No real data was used for tests or modified by installation.


## Signed-in passphrase change checkpoint — October 17, 2026
Account settings beside Sign out now allows current-passphrase verification and confirmed new credentials. All sessions and unused reset codes are revoked on success; books and administrator permissions stay intact. Synthetic API/browser tests passed for authentication/CSRF, validation, throttling, concurrent credential changes, multiple sessions, data preservation, secret-free audit, hold-to-show controls, success/re-login, and responsive widths. Existing account and administrator recovery regressions passed. See PASSPHRASE-CHANGES.md. No real passphrase was changed during installation.

## Release planning decision — October 17, 2026
The owner chose straightforward open self-service registration rather than invitations. Keep new registrations as ordinary members; retain sole owner administration. Signup-abuse defenses and HTTPS deployment checks remain required before public exposure. The owner manually verified automatic sync, choosing the device copy in a conflict, and the passphrase-change screen. RELEASE-CHECKLIST.md is the current release summary; earlier checkpoint notes above are historical.

## Invitation-only account decision — October 17, 2026
The owner superseded the earlier open-registration decision: known people receive private administrator-issued invitations for accounts; everyone else may use device-only mode without an account. Seven-day, one-use, hash-only invitations are enforced server-side and claimed transactionally. Existing accounts, roles, and books are preserved. Administrator UI requires reauthentication; a local owner CLI supports initial bootstrap. Restores invalidate outstanding invites. The complete regression suite passed in isolated synthetic databases, including invite expiry/replay/races, ordinary member roles, local access, account preservation, and secret-free logging. No invitation was generated for a real person during development.

## Manual invitation verification — October 18, 2026
The owner confirmed an invitation creates a new account and reuse is rejected. Error wording now distinguishes a missing invitation from an invalid, expired, or already-used invitation. Existing accounts and private character data are unchanged.

## Encrypted OneDrive backup checkpoint — October 18, 2026
The owner chose OneDrive for the second backup location. Completed, verified SQLite snapshots now export as AES-256-GCM encrypted files in a dedicated OneDrive folder. The recovery key/configuration stay in Git-ignored private-admin outside OneDrive; the owner must save a separate secure key copy. Startup/hourly checks retry exports even when no new daily snapshot is due. Wrong-key/tamper and restore tests passed with synthetic accounts, along with existing backup/invitation regressions. Local encrypted copies were created and verified; actual cloud upload and remote sharing settings require OneDrive confirmation. Off-device key storage, retention, monitoring, and the eventual Linux drill remain pending.

Backup recovery key was replaced October 18 after accidental disclosure. Replacement encryption and retirement were verified; accounts and character books stayed unchanged. Private archives retain previous recovery material locally. Owner must confirm OneDrive sync and update the separate Bitwarden secure note from the local active key file. No key values belong in this roadmap or Git.
