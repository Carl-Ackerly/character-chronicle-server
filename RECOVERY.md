# Administrator-assisted recovery — local test

Players contact the administrator before resetting a forgotten passphrase. Email delivery and self-service email recovery are not configured. Continue using test accounts and test passphrases on http://127.0.0.1:3002. Nothing is exposed publicly.

## Designate the owner administrator

Create a normal test account first. From the server project terminal, run:

```powershell
node account-admin.js grant-admin YOUR_USERNAME
```

Replace `YOUR_USERNAME` with the account you intend to administer the service. This command uses local operating-system access as the bootstrap authority. It revokes that account's existing sessions; sign in again afterward. No web endpoint can grant administrator privileges, and normal registrations always get the member role. No account is automatically promoted by installing this feature.

## Help a player recover access

1. Verify the requester through a previously trusted private channel or in person. A username alone does not prove identity. The application requires an acknowledgement, but the administrator must actually perform this check.
2. Sign in as the administrator and select **Account administration**.
3. Select the member account, enter your current administrator passphrase, and confirm identity verification.
4. Select **Generate reset code**. A random code is displayed once and expires in 15 minutes. Issuing another code invalidates earlier unused codes for that member.
5. Share the code privately with the verified person. Do not put it in Git, public chat, logs, or the project documentation. Notify them that a reset was issued.
6. They select **Reset passphrase**, enter their username and code, and enter the new passphrase twice. They may reveal the new passphrase to check it.
7. On success, the code becomes unusable and all previous sessions for that account are revoked. They must sign in with the new passphrase; reset does not automatically sign them in.

Character books, revisions, prepared spells, notes, and resources are not updated by this process. The new passphrase is hashed using the existing scrypt policy; administrators never see it. The browser clears submitted passphrase fields after success. Audit events contain IDs, action, outcome, and timestamp, not passwords, codes, or character contents.

## Recover the administrator account

Web administrators cannot issue reset codes for administrator accounts. If the owner loses their passphrase, use the local server terminal:

```powershell
node account-admin.js recover-admin YOUR_USERNAME
```

The command prints a one-use code for an existing administrator. Use it in **Reset passphrase**. Keep the terminal output private. This recovery authority depends on access to the server's operating system and database files; protect that access, especially on the future Linux host. This does not reset an operating-system password or recover a lost database backup.

## Implementation

- `account-recovery.js` performs additive role/credential-version migration, token issuance, transactional redemption, and audit records.
- `account-auth.js` applies administrator authorization, current-passphrase reauthentication, CSRF checks, rate limits, password validation, and login race protection.
- `account-admin.js` provides the local owner commands.
- No raw reset tokens are stored: only SHA-256 digests of random 256-bit tokens. Tokens expire after 15 minutes and are single-use.
- Redemption rechecks token expiry/usage and credential version inside a write transaction. Two simultaneous redemptions cannot both succeed.
- Password reset updates credentials and sessions only; it never deletes/recreates an account or its book.
- The server rechecks session validity after reading a book write, to reject a session revoked while that request was arriving.
- The account preview honors `hidden` fields even where existing layout styles set display properties.

The active database gets new tables and default member roles, not a destructive rebuild. Before installing it on the local test service, a consistent SQLite snapshot is saved outside the repository. Existing test accounts and books remain. No administrator is appointed without an explicit local owner command.

## Verification

Run `node recovery.test.cjs` and `node accounts.test.cjs`. The tests use temporary databases and synthetic accounts. They verify member rejection, reauthentication/CSRF requirements, rate limits, expiry, replacement of earlier codes, concurrent one-use redemption, wrong-user rejection, old-password failure, session revocation, private-book preservation, audit contents, owner recovery, legacy database migration, and browser form behavior.

## Still outstanding

Authenticated passphrase changes, invitation-only enrollment, automatic recovery notifications, email verification/delivery (if selected later), audit retention policies, Secure-cookie/HTTPS deployment, operational backup automation, independent review, and remote access remain future work. The local HTTP test cookie is still a loopback exception; these changes do not make the service ready for public hosting.

Reference: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Completion screens

After generating a code, the dialog switches to Reset code ready: completed account/passphrase fields are hidden, the code remains available to copy, and Done closes the task. Start another recovery explicitly opens a fresh form. After a player resets their passphrase, the old contact-administrator instructions are replaced by a Passphrase reset confirmation with Sign in and Done actions. No additional reset is needed.


See LOGGING.md for private audit files and the owner terminal command for verified player resets. Recovery controls are now on the homepage.
