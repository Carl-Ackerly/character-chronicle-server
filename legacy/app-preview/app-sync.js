(() => {
  'use strict';
  const key = 'combat-tracker-prototype-v1', metaKey = 'character-chronicle-test-sync-v1';
  let state = null, busy = false, timer, conflict = false;
  try { state = JSON.parse(localStorage.getItem(metaKey)); } catch {}
  const panel = document.createElement('section');
  panel.style.cssText = 'max-width:1160px;margin:12px auto;padding:12px 24px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center;flex-wrap:wrap';
  panel.innerHTML = '<strong>Separate server test</strong><span id="syncStatus" role="status">Local copy only</span><button id="connectTest" type="button">Connect test saves</button><button id="loadTest" type="button">Load server copy</button>';
  document.querySelector('main').before(panel);
  const status = panel.querySelector('#syncStatus');
  const say = text => { status.textContent = text; };
  const current = () => localStorage.getItem(key) || JSON.stringify({ version: 1, characters: [], active: null });
  function remember() { localStorage.setItem(metaKey, JSON.stringify(state)); }
  async function getServer() {
    const response = await fetch('/api/book', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Server unavailable');
    return response.json();
  }
  async function flush() {
    if (!state || busy || conflict) return;
    busy = true;
    try {
      let snapshot = current();
      while (snapshot !== state.baseline) {
        say('Saving test book…');
        const response = await fetch('/api/book', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: state.revision, book: JSON.parse(snapshot) }), signal: AbortSignal.timeout(10000) });
        if (response.status === 409) { conflict = true; say('Conflict: local copy kept. Back up before loading server copy.'); return; }
        if (!response.ok) throw Error('Save failed');
        const result = await response.json();
        state = { revision: result.revision, baseline: snapshot };
        remember();
        snapshot = current();
      }
      say('Test book saved to server');
    } catch { say('Saved on this device; server pending. Retry Connect when available.'); }
    finally { busy = false; }
  }
  panel.querySelector('#connectTest').onclick = async () => {
    if (busy) return;
    try {
      const remote = await getServer(), local = current();
      if (!remote.book) state = { revision: 0, baseline: '' };
      else if (JSON.stringify(remote.book) === JSON.stringify(JSON.parse(local))) state = { revision: remote.revision, baseline: local };
      else if (!state || state.revision !== remote.revision) { conflict = true; say('Different server copy. Local data kept; use Load server copy to review replacement.'); return; }
      conflict = false; remember(); await flush();
    } catch { say('Cannot connect. Local copy kept.'); }
  };
  panel.querySelector('#loadTest').onclick = async () => {
    if (busy) return;
    try {
      const remote = await getServer();
      if (!remote.book) { say('No server copy yet.'); return; }
      const local = current();
      if (JSON.parse(local).characters.length && !confirm('Replace this TEST browser copy with the server copy? A safety download of this browser copy will be requested first. Your live app is separate.')) return;
      if (JSON.parse(local).characters.length) {
        const url = URL.createObjectURL(new Blob([local], { type: 'application/json' }));
        const link = document.createElement('a');link.href = url;link.download = 'Character-Chronicle-backup-before-test-load-' + Date.now() + '.json';link.click();setTimeout(() => URL.revokeObjectURL(url), 10000);
        localStorage.setItem('character-chronicle-before-test-load', local);
      }
      const raw = JSON.stringify(remote.book);
      localStorage.setItem(key, raw);
      state = { revision: remote.revision, baseline: raw };remember();location.reload();
    } catch { say('Could not load. Local copy kept.'); }
  };
  window.addEventListener('character-book-saved', () => { clearTimeout(timer);timer = setTimeout(flush, 500); });
  window.addEventListener('online', flush);
  window.addEventListener('focus', flush);
  if (state) { say('Test server connection remembered'); flush(); }
})();
