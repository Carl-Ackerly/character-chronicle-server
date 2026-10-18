(() => {
  'use strict';
  let id = null;
  try { const saved = sessionStorage.getItem('cc-account-context-v1');if (/^[a-f0-9-]{36}$/.test(saved || '')) id = saved; } catch {}
  window.CharacterAccountContext = { id, key: id ? 'cc-account-book:' + id : 'combat-tracker-prototype-v1' };
})();
