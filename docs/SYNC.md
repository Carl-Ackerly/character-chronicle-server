# Automatic account-book synchronization

Sign into the same account on each device. Account books save after changes and check for newer server copies every 15 seconds while the page is visible, plus on returning to the page or reconnecting. Device-only books are not uploaded automatically. Devices must be able to reach this same server; the current loopback preview is not a public or phone-accessible service.

Clean local copies receive newer server copies automatically. Checking pauses while an input/select/textarea is focused or a dialog is open, so a background update does not reload a form mid-entry. Remote loading currently refreshes the app and can return to the character contents page. Hidden/background mobile pages may be suspended by the browser; checks resume on return. This is automatic periodic sync, not a live collaborative editor.

Edits remain in this browser while offline. Save status distinguishes saved, pending, offline/unavailable, conflicting, and expired-session states. An uncertain save stores its attempted book with the local revision metadata; a later check recognizes that exact server result, advances the revision, and can save any newer local edits. Server revision comparisons still reject stale writes.

If both copies differ from the common saved version, automatic writes stop. Review sync conflict shows character counts and offers Use this device's changes, Use saved account changes, or Decide later. The choices apply to the whole book, not individual field merges. Both versions are stored under a unique private local-storage recovery key and a combined JSON download is requested before applying either choice. If local backup storage fails, the operation does not replace either book. The combined file is a recovery bundle, not a directly importable ordinary book file; a friendly bundle restore/import interface remains future work.

The saved-account choice replaces only the account's local copy. The device choice uses the latest reviewed revision for an explicit server save. If either copy changes during review, the app asks to review again instead of silently overwriting it. Account ownership checks also apply to all these requests.

Expired or changed sessions offer Sign in again, retaining the pending local book and metadata. Signing back into the same account resumes reconciliation. Signing into a different account uses a separate cache; pending data is not transferred into another player's book.

## Verified locally

Synthetic API/browser tests cover two independent browsers on one account, automatic refresh without a manual load, conflicting offline edits, both conflict choices and retained recovery bundles, lost save responses, and reauthentication with pending edits. Existing account isolation, stale-account tabs, guest preservation, registration, and administrator recovery tests also pass. Alaric and real account books are not test fixtures.

## Before release

Test actual phone/PC connectivity on the chosen host, browser background behavior, simultaneous tabs sharing one browser's local storage, storage quota failures, and longer outages. Finish shared-device cache policy, user-facing recovery-bundle import, and per-character/field-level conflict review if desired. No public deployment or remote access has been enabled by these changes.
