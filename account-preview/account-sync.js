(() => {
  'use strict';
  const context = window.CharacterAccountContext;
  const key = context.key, metaKey = context.id ? 'cc-account-sync:' + context.id : null;
  const empty = () => ({ version: 1, characters: [], active: null });
  const current = () => localStorage.getItem(key) || JSON.stringify(empty());
  let session = null, state = null, busy = false, checking = false, conflict = false, resolving = false, timer;
  try { if (metaKey) state = JSON.parse(localStorage.getItem(metaKey)); } catch {}
  const panel = document.createElement('section');
  panel.className = 'chronicle-home';
  panel.innerHTML = '<strong>Optional accounts · local test</strong><span id="accountStatus" role="status">Checking session…</span><button id="signIn" type="button">Sign in</button><button id="signUp" type="button">Create test account</button><button id="resetPassphrase" type="button">Reset passphrase</button><button id="accountAdmin" type="button" hidden>Account administration</button><button id="openAccount" type="button" hidden>Open my account</button><button id="signOut" type="button" hidden>Sign out</button><button id="deviceOnly" type="button" hidden>Device-only characters</button><button id="loadAccount" type="button" hidden>Load account copy</button><button id="uploadDevice" type="button" hidden>Copy device-only characters</button>';
  document.querySelector('main').before(panel);
  panel.insertAdjacentHTML('afterbegin', '<header><p class="home-eyebrow">Your adventures, kept together</p><h1>Character Chronicle</h1><p>Character sheets, spellbooks, battle resources, and the stories you write along the way.</p></header><button id="useLocal" type="button">Use on this device</button>');
  panel.querySelector('strong').remove();
  const homeNote = document.createElement('p');
  homeNote.className = 'home-note';
  homeNote.textContent = 'No account required for local play. Local characters stay in this browser. Sign in to save an account book on this server and access it from another connected device.';
  panel.append(homeNote);
  const bookBar = document.createElement('nav');bookBar.className = 'chronicle-book-bar';bookBar.setAttribute('aria-label', 'App navigation');
  bookBar.innerHTML = '<button type="button" id="chronicleHome">Home</button>';
  panel.after(bookBar);
  const accountControls = new Map([...panel.querySelectorAll('[id]')].map(node => [node.id, node]));
  const status = panel.querySelector('#accountStatus'), el = id => accountControls.get(id);
  bookBar.append(el('signOut'), el('accountAdmin'), el('loadAccount'), el('uploadDevice'));
  const accountSettings = document.createElement('button');accountSettings.type = 'button';accountSettings.textContent = 'Account settings';accountSettings.hidden = true;bookBar.insertBefore(accountSettings, el('signOut'));accountSettings.onclick = showAccountSettings;
  const signInAgain = document.createElement('button');signInAgain.type = 'button';signInAgain.textContent = 'Sign in again';signInAgain.hidden = true;bookBar.append(signInAgain);
  signInAgain.onclick = () => { session = null;controls();location.hash = 'home';showAuth(false); };
  const loginForm = document.createElement('form');loginForm.id = 'homeSignIn';
  loginForm.innerHTML = '<h2>Sign in</h2><label class="field"><span>Username</span><input name="username" autocomplete="username" minlength="3" maxlength="32" required></label><div class="field"><label for="homePassword">Passphrase</label><div class="home-password-wrap"><input id="homePassword" name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required><button class="home-password-eye" type="button" aria-label="Hold to show passphrase" title="Hold to show passphrase" aria-controls="homePassword"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div><p class="auth-message" role="status"></p><div class="home-login-actions"></div><div class="home-register-actions"></div>';
  panel.querySelector('header').after(loginForm);
  loginForm.querySelector('.home-login-actions').append(el('signIn'), el('resetPassphrase'));
  loginForm.querySelector('.home-register-actions').append(el('signUp'));
  el('signIn').type = 'submit';el('signIn').classList.add('primary');el('resetPassphrase').classList.add('text-button');
  const passwordEye = loginForm.querySelector('.home-password-eye');
  const hidePassword = () => { loginForm.elements.password.type = 'password'; };
  passwordEye.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();passwordEye.setPointerCapture(event.pointerId);loginForm.elements.password.type = 'text';
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) passwordEye.addEventListener(name, hidePassword);
  passwordEye.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault();loginForm.elements.password.type = 'text'; } });
  passwordEye.addEventListener('keyup', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault();hidePassword(); } });
  window.addEventListener('blur', hidePassword);window.addEventListener('pagehide', hidePassword);
  document.addEventListener('visibilitychange', hidePassword);window.addEventListener('hashchange', hidePassword);
  loginForm.addEventListener('reset', hidePassword);
  loginForm.onsubmit = async event => {
    event.preventDefault();const message = loginForm.querySelector('.auth-message');
    if (busy) { message.textContent = 'Wait for the current save to finish.';return; }
    const submit = el('signIn');submit.disabled = true;message.textContent = 'Signing in…';
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: loginForm.elements.username.value, password: loginForm.elements.password.value }) });
      loginForm.reset();session = result;changeContext(result.user.id, true);
    } catch (error) { message.textContent = error.message;submit.disabled = false; }
  };
  status.setAttribute('aria-live', 'polite');
  const app = document.querySelector('main'), footer = document.querySelector('footer');
  function showPage() {
    if (session?.user && session.user.id === context.id && location.hash !== '#book') history.replaceState(null, '', '#book');
    const home = location.hash !== '#book';
    panel.hidden = !home;bookBar.hidden = home;app.hidden = home;if (footer) footer.hidden = home;
    (home ? panel : bookBar).append(status);
    if (home) panel.querySelector('h1').focus({ preventScroll: true });
  }
  panel.querySelector('h1').tabIndex = -1;
  bookBar.querySelector('button').onclick = () => { location.hash = 'home'; };
  el('useLocal').onclick = () => { if (busy) { say('Wait for the current save to finish.');return; }if (context.id) changeContext(null, true);else location.hash = 'book'; };
  window.addEventListener('hashchange', showPage);showPage();
  const say = value => { status.textContent = value;el('loadAccount').hidden = !conflict || !active() || !signInAgain.hidden;el('loadAccount').textContent = 'Review sync conflict'; };
  const active = () => session?.user?.id === context.id;
  function controls() {
    accountSettings.hidden = !active();
    loginForm.hidden = active();
    el('accountAdmin').hidden = !active() || session?.user?.role !== 'admin';
    el('signIn').hidden = active();el('signUp').hidden = active();
    el('signOut').hidden = !session?.user;
    el('openAccount').hidden = !session?.user;
    el('openAccount').textContent = 'Open my account book';
    el('deviceOnly').hidden = true;
    bookBar.querySelector('#chronicleHome').hidden = active();
    el('loadAccount').hidden = !active() || !conflict;
    let hasLocalCharacters = false;
    try { hasLocalCharacters = !!JSON.parse(localStorage.getItem('combat-tracker-prototype-v1'))?.characters?.length; } catch {}
    el('uploadDevice').hidden = !active() || JSON.parse(current()).characters.length > 0 || !hasLocalCharacters;
    showPage();
  }
  async function api(url, options = {}) {
    const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', 'X-CC-Client': '1', ...(session?.csrf ? { 'X-CSRF-Token': session.csrf } : {}), ...options.headers } });
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error(result.message || 'Request failed'), { status: response.status });
    return result;
  }
  function remember() { localStorage.setItem(metaKey, JSON.stringify(state)); }
  function changeContext(id, openBook = false) {
    if (id) sessionStorage.setItem('cc-account-context-v1', id);else sessionStorage.removeItem('cc-account-context-v1');
    location.hash = openBook ? 'book' : 'home';location.reload();
  }
  function checkOwner(data) {
    if (data.accountId !== context.id) throw Object.assign(Error('Another account is signed in. Local changes kept; sign in again.'), { status: 403 });
    return data;
  }
  async function serverBook() { return checkOwner(await api('/api/book')); }
  function load(remote) {
    const raw = JSON.stringify(remote.book);
    localStorage.setItem(key, raw);state = { revision: remote.revision, baseline: raw };remember();location.reload();
  }
  function backup(raw) {
    localStorage.setItem('cc-before-account-load:' + context.id, raw);
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a');link.href = url;link.download = 'Character-Chronicle-backup-before-account-load-' + Date.now() + '.json';link.click();setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function flush() {
    if (!active() || !state || busy || conflict) return;
    busy = true;
    try {
      let raw = current();
      while (raw !== state.baseline) {
        say('Saving your account book…');
        state.pending = raw;remember();
        const result = checkOwner(await api('/api/book', { method: 'PUT', body: JSON.stringify({ accountId: context.id, revision: state.revision, book: JSON.parse(raw) }) }));
        state = { revision: result.revision, baseline: raw };remember();raw = current();
      }
      say('Account book saved · ' + session.user.username);
    } catch (error) {
      if ([401, 403, 409].includes(error.status)) conflict = true;
      if ([401, 403].includes(error.status)) signInAgain.hidden = false;
      say(error.status === 409 ? 'Newer server copy exists. Local changes kept; back up before loading.' : error.status === 401 ? 'Session expired. Local copy kept; sign in again.' : error.status === 403 ? 'Account changed. Local copy kept; sign in again.' : 'Saved on this device; account sync pending.');
    } finally { busy = false; }
  }
  async function reconcile() {
    if (!active() || busy || checking || resolving) return;
    checking = true;
    try {
      const remote = await serverBook(), local = current();
      if (state?.pending && JSON.stringify(remote.book) === state.pending) { state = { revision: remote.revision, baseline: state.pending };conflict = false;remember();return flush(); }
      if (!remote.book) { state = { revision: 0, baseline: '' };conflict = false;remember();return flush(); }
      if (JSON.stringify(remote.book) === JSON.stringify(JSON.parse(local))) { state = { revision: remote.revision, baseline: local };conflict = false;remember();return flush(); }
      if ((!JSON.parse(local).characters.length && !state) || (state?.baseline === local && state.revision !== remote.revision)) {
        if (document.querySelector('dialog[open]') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) { say('Updated account copy available · finishes syncing when you leave this field.');return; }
        return load(remote);
      }
      if (state?.revision === remote.revision) { conflict = false;return flush(); }
      conflict = true;say('Different account copy exists. Local changes kept; back up before loading.');
    } catch (error) { if ([401, 403].includes(error.status)) { conflict = true;signInAgain.hidden = false; }say([401, 403].includes(error.status) ? 'Sign in to this account again. Local copy kept.' : 'Server unavailable. Local account copy kept.'); }
    finally { checking = false; }
  }
  function showAuth(register) {
    if (!register) { location.hash = 'home';loginForm.hidden = false;loginForm.elements.username.focus();return; }
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<form><h2></h2><p>Local test only. Use a test passphrase, not one from another service. For a forgotten passphrase, contact the administrator for a one-use reset code.</p><label class="field"><span>Username</span><input name="username" autocomplete="username" minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" required></label><label class="field"><span>Passphrase (8–128 characters)</span><input name="password" type="password" minlength="8" maxlength="128" required></label><p class="auth-message" role="status"></p><div class="buttons"><button type="submit"></button><button type="button" class="cancel">Cancel</button></div></form>';
    const form = dialog.querySelector('form'), submit = form.querySelector('[type=submit]'), message = form.querySelector('.auth-message');
    if (register && session?.registrationRequiresInvite !== false) {
      dialog.querySelector('p').textContent = 'Accounts are for invited players. Enter the code shared by the administrator, then choose your own username and passphrase. Anyone can use this device without an account.';
      form.querySelector('label').insertAdjacentHTML('beforebegin','<label class="field"><span>Invite code</span><input name="invitationCode" autocomplete="off" minlength="64" maxlength="64" pattern="[a-fA-F0-9]{64}" required></label>');
    }
    dialog.querySelector('h2').textContent = register ? 'Create a test account' : 'Sign in';submit.textContent = register ? 'Create account' : 'Sign in';
    form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
    form.elements.password.closest('label').insertAdjacentHTML('afterend', (register ? '<label class="field"><span>Confirm passphrase</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>' : '') + '<label style="display:flex;gap:8px;align-items:center;margin:12px 0"><input name="showPassword" type="checkbox">Show passphrase</label>');
    form.elements.showPassword.onchange = () => {
      const type = form.elements.showPassword.checked ? 'text' : 'password';
      form.elements.password.type = type;
      if (register) form.elements.confirmPassword.type = type;
    };
    dialog.querySelector('.cancel').onclick = () => dialog.close();dialog.addEventListener('close', () => dialog.remove());
    form.onsubmit = async event => {
      event.preventDefault();if (register && form.elements.password.value !== form.elements.confirmPassword.value) { message.textContent = 'Passphrases do not match. Please check both fields.';return; }if (busy) { message.textContent = 'Wait for the current save to finish.';return; }submit.disabled = true;
      try {
        const result = await api('/api/auth/' + (register ? 'register' : 'login'), { method: 'POST', body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value, ...(form.elements.invitationCode ? {invitationCode:form.elements.invitationCode.value} : {}) }) });
        form.elements.password.value = '';if (register) form.elements.confirmPassword.value = '';session = result;changeContext(result.user.id, true);
      } catch (error) { message.textContent = error.message;submit.disabled = false; }
    };
    document.body.append(dialog);dialog.showModal();
  }
  function passwordVisibility(form) {
    form.elements.showPassword.onchange = () => {
      for (const field of form.querySelectorAll('[data-new-password]')) field.type = form.elements.showPassword.checked ? 'text' : 'password';
    };
  }
  function showReset() {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<form><h2>Reset passphrase</h2><p class="reset-intro">Contact the administrator and verify your identity first. Enter the one-use code they give you. Your character data will stay intact.</p><label class="field"><span>Username</span><input name="username" autocomplete="username" required maxlength="32"></label><label class="field"><span>Reset code</span><input name="code" type="password" autocomplete="off" pattern="[a-fA-F0-9]{64}" minlength="64" maxlength="64" required></label><label class="field"><span>New passphrase</span><input name="password" data-new-password type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label class="field"><span>Confirm new passphrase</span><input name="confirmPassword" data-new-password type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label style="display:flex;gap:8px;align-items:center"><input name="showPassword" type="checkbox">Show new passphrase</label><p class="reset-message" role="status"></p><div class="buttons"><button type="submit">Reset passphrase</button><button class="cancel" type="button">Cancel</button></div></form>';
    const form = dialog.querySelector('form'), message = dialog.querySelector('.reset-message'), submit = form.querySelector('[type=submit]');
    passwordVisibility(form);
    dialog.querySelector('.cancel').onclick = () => dialog.close();dialog.addEventListener('close', () => { form.reset();dialog.remove(); });
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy) { message.textContent = 'Wait for the current save to finish.';return; }
      if (form.elements.password.value !== form.elements.confirmPassword.value) { message.textContent = 'New passphrases do not match.';return; }
      submit.disabled = true;
      try {
        const result = await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ username: form.elements.username.value, code: form.elements.code.value, password: form.elements.password.value, confirmPassword: form.elements.confirmPassword.value }) });
        form.reset();for (const label of form.querySelectorAll('label')) label.hidden = true;
        for (const input of form.querySelectorAll('input')) input.disabled = true;
        dialog.querySelector('h2').textContent = 'Passphrase reset';
        dialog.querySelector('.reset-intro').textContent = 'Your new passphrase is saved. No more reset steps are needed. Your characters are unchanged.';
        dialog.querySelector('.cancel').textContent = 'Done';
        form.onsubmit = event => event.preventDefault();
        message.textContent = result.message;submit.type = 'button';submit.textContent = 'Sign in';submit.disabled = false;
        submit.onclick = () => { dialog.close();showAuth(false); };
      } catch (error) { message.textContent = error.message;submit.disabled = false; }
    };
    document.body.append(dialog);dialog.showModal();
  }
  function showAccountSettings() {
    if (!active()) return;
    const dialog = document.createElement('dialog');dialog.className = 'account-settings';
    dialog.innerHTML = '<form><h2>Change passphrase</h2><p>Enter your current passphrase and choose a new one. After saving, all devices will need to sign in again. Your characters will stay intact.</p><div class="settings-fields"></div><p class="settings-message" role="status"></p><div class="buttons"><button type="submit">Change passphrase</button><button type="button" class="cancel">Cancel</button></div></form>';
    const form = dialog.querySelector('form'), message = dialog.querySelector('.settings-message'), submit = form.querySelector('[type=submit]');
    const listeners = new AbortController(), hiddenFields = [];
    for (const [name, label] of [['currentPassword','Current passphrase'],['password','New passphrase'],['confirmPassword','Confirm new passphrase']]) {
      const row = document.createElement('div');row.className = 'field';
      row.innerHTML = '<label></label><div class="settings-password-wrap"><input type="password" minlength="8" maxlength="128" required><button type="button" class="settings-password-eye"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div>';
      const input = row.querySelector('input'), eye = row.querySelector('button');input.name = name;input.id = 'settings-' + name;input.autocomplete = name === 'currentPassword' ? 'current-password' : 'new-password';
      row.querySelector('label').textContent = label;row.querySelector('label').htmlFor = input.id;eye.setAttribute('aria-label', 'Hold to show ' + label.toLowerCase());eye.setAttribute('aria-controls', input.id);
      const hide = () => input.type = 'password';hiddenFields.push(hide);
      eye.onpointerdown = event => { if (event.button === 0) { event.preventDefault();eye.setPointerCapture(event.pointerId);input.type = 'text'; } };
      for (const event of ['pointerup','pointercancel','lostpointercapture','blur']) eye.addEventListener(event,hide);
      eye.onkeydown = event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault();input.type = 'text'; } };
      eye.onkeyup = event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault();hide(); } };
      form.querySelector('.settings-fields').append(row);
    }
    const hideAll = () => hiddenFields.forEach(hide => hide());
    window.addEventListener('blur',hideAll,{signal:listeners.signal});document.addEventListener('visibilitychange',hideAll,{signal:listeners.signal});
    dialog.querySelector('.cancel').onclick = () => { if (!submit.disabled) dialog.close(); };
    dialog.addEventListener('cancel', event => { if (submit.disabled) event.preventDefault(); });
    dialog.addEventListener('close', () => { form.reset();listeners.abort();dialog.remove(); });
    form.onsubmit = async event => {
      event.preventDefault();if (submit.disabled) return;
      if (busy) { message.textContent = 'Wait for the current character save to finish.';return; }
      if (form.elements.password.value !== form.elements.confirmPassword.value) { message.textContent = 'New passphrases do not match.';return; }
      submit.disabled = true;hideAll();message.textContent = 'Changing passphrase…';
      try {
        const result = await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:form.elements.currentPassword.value,password:form.elements.password.value,confirmPassword:form.elements.confirmPassword.value})});
        form.reset();for (const input of form.querySelectorAll('input')) input.disabled = true;form.querySelector('.settings-fields').hidden = true;
        dialog.querySelector('h2').textContent = 'Passphrase changed';message.textContent = result.message;session = null;controls();
        submit.type = 'button';submit.textContent = 'Sign in';submit.disabled = false;form.onsubmit = e => e.preventDefault();submit.onclick = () => { dialog.close();location.hash = 'home';showAuth(false); };
        dialog.querySelector('.cancel').textContent = 'Done';dialog.querySelector('.cancel').onclick = () => { dialog.close();location.hash = 'home';showAuth(false); };
      } catch(error) { message.textContent = error.message;submit.disabled = false; }
    };
    document.body.append(dialog);dialog.showModal();
  }
  function showInvite() {
    if (!active() || session.user.role !== 'admin') return;
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<form><h2>Invite a player</h2><p class="invite-intro">Create a private code for one person. It expires after seven days. They choose their own passphrase and receive ordinary player access.</p><label class="field"><span>Your administrator passphrase</span><input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label><label class="field" data-invite-output hidden><span>One-use invite code</span><input name="code" readonly autocomplete="off"></label><p class="invite-message" role="status"></p><div class="buttons"><button type="submit">Create invitation</button><button type="button" class="copy-invite" hidden>Copy invitation</button><button type="button" class="cancel">Cancel</button></div></form>';
    const form = dialog.querySelector('form'), submit = form.querySelector('[type=submit]'), copy = form.querySelector('.copy-invite'), message = form.querySelector('.invite-message');let expires;
    dialog.querySelector('.cancel').onclick = () => dialog.close();dialog.addEventListener('close',()=>{clearTimeout(expires);form.reset();dialog.remove();});
    copy.onclick = async () => { try { await navigator.clipboard.writeText(form.elements.code.value);message.textContent = 'Invitation copied. Send it privately to the person you want to invite.'; } catch { message.textContent = 'Select the invite code and copy it manually.'; } };
    form.onsubmit = async event => {
      event.preventDefault();if (submit.disabled || submit.hidden) return;submit.disabled = true;
      try {
        const result = await api('/api/admin/invitations',{method:'POST',body:JSON.stringify({password:form.elements.password.value})});
        form.elements.code.value = result.code;form.elements.password.closest('label').hidden = true;form.elements.password.disabled = true;form.querySelector('[data-invite-output]').hidden = false;submit.hidden = true;copy.hidden = false;
        dialog.querySelector('h2').textContent = 'Invitation ready';dialog.querySelector('.cancel').textContent = 'Done';
        message.textContent = 'Created successfully. Share this code privately. Expires ' + new Date(result.expiresAt).toLocaleString() + '.';
        expires = setTimeout(()=>{form.elements.code.value='';form.querySelector('[data-invite-output]').hidden=true;copy.hidden=true;message.textContent='Invitation expired. Create a new invitation if needed.';},Math.max(0,result.expiresAt-Date.now()));
      } catch(error) { message.textContent = error.message; }
      finally { form.elements.password.value = '';submit.disabled = false; }
    };
    document.body.append(dialog);dialog.showModal();
  }
  async function showAdmin() {
    if (!active() || session.user.role !== 'admin') return;
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<form><h2>Account administration</h2><p class="admin-intro">Issue recovery codes only after verifying the person through a trusted private channel. Codes expire after 15 minutes. Creating a new code invalidates any earlier unused code.</p><label class="field"><span>Account to recover</span><select name="accountId" required><option value="">Select an account</option></select></label><label class="field"><span>Your administrator passphrase</span><input name="adminPassword" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label><label style="display:flex;gap:8px;align-items:center"><input name="identityConfirmed" type="checkbox" required>I verified this person’s identity</label><p class="admin-message" role="status"></p><label class="field" hidden data-reset-output><span>Private one-use reset code</span><input name="issuedCode" readonly autocomplete="off"></label><div class="buttons"><button type="submit">Generate reset code</button><button type="button" class="copy-code" hidden>Copy reset code</button><button type="button" class="another-reset" hidden>Start another recovery</button><button type="button" class="show-audit">Recent recovery activity</button><button type="button" class="cancel">Close</button></div></form><ul class="audit-list"></ul>';
    const form = dialog.querySelector('form'), message = dialog.querySelector('.admin-message'), output = dialog.querySelector('[data-reset-output]'), copy = dialog.querySelector('.copy-code'), submit = form.querySelector('[type=submit]');
    const inviteButton = document.createElement('button');inviteButton.type = 'button';inviteButton.textContent = 'Invite a player';inviteButton.onclick = () => { dialog.close();showInvite(); };dialog.querySelector('.buttons').prepend(inviteButton);
    let accounts = [], timer;
    const another = dialog.querySelector('.another-reset');
    const recoveryFields = [form.elements.accountId, form.elements.adminPassword, form.elements.identityConfirmed];
    const intro = dialog.querySelector('.admin-intro'), initialIntro = intro.textContent;
    another.onclick = () => {
      clearTimeout(timer);form.reset();
      for (const field of recoveryFields) { field.closest('label').hidden = false;field.disabled = false; }
      output.hidden = true;copy.hidden = true;another.hidden = true;submit.hidden = false;
      dialog.querySelector('h2').textContent = 'Account administration';intro.textContent = initialIntro;
      dialog.querySelector('.cancel').textContent = 'Close';message.textContent = '';
    };
    dialog.querySelector('.cancel').onclick = () => dialog.close();dialog.addEventListener('close', () => { clearTimeout(timer);form.reset();dialog.remove(); });
    copy.onclick = async () => { try { await navigator.clipboard.writeText(form.elements.issuedCode.value);message.textContent = 'Code copied. Share it only with the verified account holder.'; } catch { message.textContent = 'Select the code field and copy it manually.'; } };
    dialog.querySelector('.show-audit').onclick = async () => {
      try {
        const data = await api('/api/admin/audit'), list = dialog.querySelector('.audit-list');list.replaceChildren();
        for (const event of data.events) { const item = document.createElement('li');const target = accounts.find(a => a.id === event.target_account_id)?.username || '—';item.textContent = new Date(event.created_at).toLocaleString() + ' · ' + event.action + ' · ' + target + ' · ' + event.outcome;list.append(item); }
        if (!data.events.length) { const item = document.createElement('li');item.textContent = 'No recovery activity yet.';list.append(item); }
      } catch (error) { message.textContent = error.message; }
    };
    form.onsubmit = async event => {
      event.preventDefault();if (submit.hidden) return;submit.disabled = true;clearTimeout(timer);form.elements.issuedCode.value = '';output.hidden = true;copy.hidden = true;
      try {
        const result = await api('/api/admin/recovery', { method: 'POST', body: JSON.stringify({ accountId: form.elements.accountId.value, password: form.elements.adminPassword.value, identityConfirmed: form.elements.identityConfirmed.checked }) });
        form.elements.issuedCode.value = result.code;output.hidden = false;copy.hidden = false;form.elements.identityConfirmed.checked = false;
        const targetName = accounts.find(account => account.id === form.elements.accountId.value)?.username || 'the selected account';
        for (const field of recoveryFields) { field.closest('label').hidden = true;field.disabled = true; }
        submit.hidden = true;another.hidden = false;
        dialog.querySelector('h2').textContent = 'Reset code ready';
        intro.textContent = 'The code for ' + targetName + ' has been created. You do not need to enter your administrator passphrase again. Copy the code, share it privately, then select Done.';
        dialog.querySelector('.cancel').textContent = 'Done';
        message.textContent = 'Code created successfully. Expires at ' + new Date(result.expiresAt).toLocaleTimeString() + '. The player uses it in Reset passphrase to finish.';
        timer = setTimeout(() => { form.elements.issuedCode.value = '';output.hidden = true;copy.hidden = true;dialog.querySelector('h2').textContent = 'Reset code expired';message.textContent = 'This reset code has expired. Verify identity before issuing another.'; }, Math.max(0, result.expiresAt - Date.now()));
      } catch (error) { message.textContent = error.message; }
      finally { form.elements.adminPassword.value = '';submit.disabled = false; }
    };
    document.body.append(dialog);dialog.showModal();
    try { accounts = (await api('/api/admin/accounts')).accounts;for (const account of accounts.filter(a => a.role !== 'admin')) { const option = document.createElement('option');option.value = account.id;option.textContent = account.username;form.elements.accountId.append(option); } }
    catch (error) { message.textContent = error.message;submit.disabled = true; }
  }
  el('resetPassphrase').onclick = showReset;
  el('accountAdmin').onclick = showAdmin;
  el('signUp').onclick = () => showAuth(true);
  el('openAccount').onclick = () => { if (!busy) { if (active()) location.hash = 'book';else changeContext(session.user.id, true); } };
  el('deviceOnly').onclick = () => { if (!busy) changeContext(null); };
  el('signOut').onclick = async () => {
    if (busy) { say('Wait for the current save to finish.');return; }
    try { await api('/api/auth/logout', { method: 'POST', body: '{}' });session = null;changeContext(null); }
    catch (error) { say('Could not sign out of the server. Please retry.'); }
  };
  el('loadAccount').onclick = async () => {
    if (busy || resolving) return;
    resolving = true;
    try {
      const remote = await serverBook();if (!remote.book) { say('No saved account book yet.');return; }
      const raw = current();
      const dialog = document.createElement('dialog');
      dialog.innerHTML = '<h2>Review sync conflict</h2><p>Both devices made changes. Choose the book to continue with. Both copies will be saved privately on this device first.</p><p class="conflict-summary"></p><p class="conflict-message" role="status"></p><div class="buttons"><button type="button" data-copy="device">Use this device’s changes</button><button type="button" data-copy="server">Use saved account changes</button><button type="button" data-copy="cancel">Decide later</button></div>';
      dialog.querySelector('.conflict-summary').textContent = 'This device: ' + JSON.parse(raw).characters.length + ' characters. Saved account: ' + remote.book.characters.length + ' characters. These choices apply to the whole character book.';
      dialog.addEventListener('close', () => { resolving = false;dialog.remove(); });
      for (const button of dialog.querySelectorAll('[data-copy]')) button.onclick = async () => {
        if (button.dataset.copy === 'cancel') { dialog.close();return; }
        const buttons = [...dialog.querySelectorAll('button')];buttons.forEach(b => b.disabled = true);
        try {
          const latest = await serverBook();
          if (current() !== raw || latest.revision !== remote.revision) throw Error('A copy changed while this was open. Close and review the latest copies.');
          const pair = JSON.stringify({ version: 1, type: 'character-chronicle-sync-conflict', accountId: context.id, savedAt: new Date().toISOString(), device: JSON.parse(raw), server: remote.book, serverRevision: remote.revision });
          localStorage.setItem('cc-conflict-backup:' + context.id + ':' + crypto.randomUUID(), pair);
          const url = URL.createObjectURL(new Blob([pair], {type:'application/json'})), link = document.createElement('a');link.href = url;link.download = 'Character-Chronicle-backup-sync-conflict-' + Date.now() + '.json';link.click();setTimeout(() => URL.revokeObjectURL(url), 10000);
          if (button.dataset.copy === 'server') return load(remote);
          const result = checkOwner(await api('/api/book', { method:'PUT', body:JSON.stringify({ accountId:context.id, revision:remote.revision, book:JSON.parse(raw) }) }));
          state = { revision:result.revision, baseline:raw };remember();conflict = false;dialog.close();say('Account book saved · ' + session.user.username);
        } catch (error) { dialog.querySelector('.conflict-message').textContent = error.status === 409 ? 'The other device saved again. Close and review the latest copies.' : error.message;buttons.forEach(b => b.disabled = false); }
      };
      document.body.append(dialog);dialog.showModal();
    } catch (error) { resolving = false;say('Could not review. Local copy kept.'); }
    finally { if (!document.querySelector('[data-copy="device"]')) resolving = false; }
  };
  el('uploadDevice').onclick = async () => {
    if (busy) return;
    try {
      const remote = await serverBook();
      if (remote.book?.characters.length || JSON.parse(current()).characters.length) { say('Copy is available only for an empty account. Existing books were kept.');return; }
      const raw = localStorage.getItem('combat-tracker-prototype-v1');
      if (!raw || !JSON.parse(raw).characters.length) { say('No device-only characters in this test browser.');return; }
      if (!confirm('Copy device-only characters into this empty account? The device-only originals will remain.')) return;
      const result = checkOwner(await api('/api/book', { method: 'PUT', body: JSON.stringify({ accountId: context.id, revision: remote.revision, book: JSON.parse(raw) }) }));
      localStorage.setItem(key, raw);state = { revision: result.revision, baseline: raw };remember();location.reload();
    } catch { say('Copy failed. Device-only originals were kept.'); }
  };
  window.addEventListener('character-book-saved', () => { clearTimeout(timer);timer = setTimeout(flush, 500); });
  window.addEventListener('online', backgroundSync);
  window.addEventListener('focus', backgroundSync);
  // Avoid reloading a clean book while the player is typing or using a dialog.
  function backgroundSync() {
    if (document.hidden || document.querySelector('dialog[open]') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
    reconcile();
  }
  const syncPoll = setInterval(backgroundSync, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) backgroundSync(); });
  window.addEventListener('pagehide', () => clearInterval(syncPoll));
  (async () => {
    try {
      session = await api('/api/auth/me');controls();
      if (active()) return reconcile();
      say(context.id ? 'Cached account copy. Sign in to resume syncing.' : session.user ? 'Device-only mode · account available via Open my account' : 'Device-only mode · no account required');
    } catch { controls();say(context.id ? 'Offline account copy · changes stay on this browser' : 'Device-only mode · server unavailable'); }
  })();
})();
