# Offline device-only play

Open the private HTTPS app in the intended browser or installed Home Screen app while the server and Tailscale are available. Give the initial download time to finish. The footer then shows **Offline loading ready**. Each browser, origin, and installed app needs its own initial download; Safari and a Home Screen app may have separate storage.

After setup, **Use on this device** can reopen and save local characters even when the host PC is off, its server is stopped, or the phone has no network. Those local characters stay in that device's browser. They are separate from signed-in account books; offline loading does not copy an account character into device-only mode.

Account creation, sign-in, recovery, administration and server synchronization still require the running server and private connection. An existing account book may be locally cached, but this feature does not promise new offline account sign-in. Existing pending-edit/conflict protections remain responsible for account reconnection.

The service worker precaches only an explicit allowlist of public frontend files. It never caches or queues API requests, credentials, account-book HTTP responses, database files, or owner files. Existing browser-local character storage is unchanged. Old shell caches are removed only when the replacement worker activates. Existing tabs are not forcibly refreshed or reloaded during edits.

## Updates

Whenever shipped frontend files change, increment the CACHE version in frontend/sw.js. A complete new shell downloads while online and waits until existing app tabs/windows close before replacing the old shell. Reopen after closing all app windows to use the installed update. Do not add skipWaiting or force reload without protecting pending edits. Keep the allowlist current when adding frontend assets.

Offline browser storage can be removed by the device, by clearing website data, or by private browsing policies. It is not a backup. Retain exports and server backups; do not clear website data as a troubleshooting shortcut.

## Verification

Run node tests/offline.test.cjs. It uses disposable data and a phone-sized browser to check reopening after a real test-server shutdown, local editing and reload, airplane-mode simulation, account API cache exclusion, and server recovery. Test actual iPhone Home Screen cold launch and resume before public release.
