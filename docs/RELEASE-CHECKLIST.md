# Character Chronicle: current release checklist

Updated October 17, 2026. This is the current status; older checkpoint notes in ROADMAP.md describe earlier stages.

## Verified local functionality

- Optional accounts with private character books, ordinary member registration, and server-enforced administrator permissions.
- Sign-in homepage with device-only use, confirmation on registration, hold-to-show passphrase, and readable theme buttons.
- Owner-designated sole administrator in the local database. The private owner username/recovery record stays outside Git.
- Administrator-assisted, expiring one-use recovery; authenticated passphrase changes revoke sessions and unused recovery codes.
- Full-book saving and automatic visible-page checks, offline pending edits, conflict review with both versions retained, and uncertain-save reconciliation.
- Daily consistent database snapshots, integrity checks, and separate-file restore tests. Private security audit-file export.
- Owner manually confirmed automatic syncing across two browser sessions, choosing the device copy in a conflict, administrator access, and the passphrase-change screen.

Synthetic tests cover the major account, recovery, backup/restore, sync, and UI flows. This is not a claim of a completed independent security review or actual cross-platform deployment.

## Decisions

- Account creation requires a private, one-use invitation from the administrator. Anyone can use device-only mode without an account. This supersedes the earlier open-registration decision; see INVITATIONS.md.
- Preserve the chosen real owner account/database through production migration; do not publish its username record, credentials, or private data.
- Keep the existing GitHub Pages app available. This checkpoint is a separate feature branch, not a deployment or main-branch merge.
- Do not expose a public address until the dedicated mini PC is ready. VPN experimentation can be considered separately.

## Remaining before public release

- [x] Consolidate frontend/backend into a maintained source structure and documented repository relationship without breaking the existing release.
- [ ] Configure the dedicated Linux host, supported Node runtime, least-privilege service, automatic startup/shutdown, updates, and monitoring.
- [ ] Choose HTTPS access and one stable app address. Configure Secure cookies, precise Host/Origin/proxy rules, and trustworthy client-IP rate limits. Do not expose database files or administration of the PC.
- [ ] Review open-registration abuse controls, limits, credential policy, recovery verification, and administrative access.
- [ ] Configure off-device backups, retention, protected storage, failure alerts, and a guided live-database restore/rollback drill.
- [ ] Test actual iPhone Safari/PC access, real network outages/background suspension, and multiple tabs sharing browser storage.
- [ ] Finish the shared-device cached-data policy and user-facing import/recovery-bundle restore; document current limitations.
- [ ] Review authorization, stored untrusted content, request defenses, dependencies, and deployment configuration independently where possible.
- [ ] Add repeatable clean-clone setup and CI. Run the regression suite on Linux as well as Windows before switching users over.
- [ ] Prepare deliberate account/data migration, preserve administrator roles and full books, retain private rollback copies, and do a small rollout before wider discovery.

## Test the checkpoint

Use a supported Node.js 24 runtime with `node:sqlite`. From this repository run `node tests/run-tests.cjs` (or `npm test`). Tests use disposable synthetic databases and browser contexts, never the real account database.

Browser tests require Playwright. If it is not already available in your development environment, install it locally with `npm install --no-save playwright`. Windows tests use installed Microsoft Edge by default; Linux uses Playwright Chromium, which must be installed with `npx playwright install chromium`. The current test helper also supports the existing local development runtime as a fallback. The development browser package is now pinned in package-lock.json; CI setup remains release work.

Start the current account preview with `node account-server.js`, then open `http://127.0.0.1:3002/`. Other devices cannot reach this loopback address on your PC. Production connectivity must be configured deliberately; publishing source to GitHub does not deploy the server.

## Privacy and cookie review
The current account preview uses local scripts, a session cookie, and browser storage for character functionality; no analytics or tracking pixels were identified in the inspected code. Before public release, publish a clear privacy/storage notice and review applicable requirements, including browser storage and optional preferences. Do not add a consent banner just as decoration. Any future nonessential tracking requiring consent must remain disabled until affirmative consent, with refusal/withdrawal respected. A third-party script is not automatically a tracker; assess its actual behavior. Recheck deployed network traffic and hosting-added services before launch.

## Verified private checkpoint — October 18, 2026

Private Tailscale Serve HTTPS is configured on the owner installation. The server still listens only on loopback; the configured HTTPS hostname is explicit, request Host/Origin checks remain enforced, and HTTPS sessions receive Secure cookies. Synthetic tests reject other hosts, cross-origin requests, and forwarding-header spoofing. The full Windows regression suite passed for this checkpoint.

The owner confirmed iPhone account sign-in and automatic server-book updates. A confirmed existing-character export was backed up and merged into its owner's account without replacing other characters; the imported record matched every source field, credentials and unrelated books remained unchanged, and verified database snapshots were made before and after. Private records and exports are excluded from Git.

This verifies private access, not public deployment. Real outage/background tests, Linux hosting, trusted client-IP handling for a future public proxy, privacy/licensing review, recovery drills and release review remain pending.
