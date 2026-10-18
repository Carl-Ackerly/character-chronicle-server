# Change a passphrase while signed in

Account settings appears beside Sign out for a signed-in account. Enter the current passphrase, new passphrase, and matching confirmation. New passphrases must be 8–128 characters and differ from the current one. Hold an eye button to reveal its field; releasing, losing focus, or hiding the page conceals it again.

The server requires an authenticated session, CSRF validation, the existing origin/custom-header checks, and the correct current passphrase. Attempts are limited to five per account per 15 minutes. New credentials use the existing scrypt hashing parameters and a fresh random salt. The server rechecks the session and credential version after hashing inside the update transaction, so a concurrent reset/change or revoked session cannot win using stale credentials.

Success updates only credential fields, invalidates all login sessions (including this browser), invalidates unused recovery codes for the account, and records a secret-free audit event. Account ownership, administrator role, character books, and saved revisions are unchanged. No current/new passphrase is stored in the audit log or private administrator notes.

The success screen explicitly confirms the change and offers Sign in. Existing browser-cached character books and pending sync metadata are preserved; signing back into the same account reconciles those copies. Other devices will need to sign in again. Forgotten passphrases still use the separate administrator-assisted Reset passphrase workflow.

Tests use synthetic accounts only and cover missing authentication, wrong current passphrase, confirmation/length rules, CSRF rejection, rate limiting, concurrent changes, revocation across multiple sessions, reset-code invalidation, preserved administrator privileges and nested books, private audit records, form success and re-login, hold-to-show, and phone widths. Actual user credentials were not changed during installation. This remains a local preview; HTTPS hosting and production release checks remain pending.
