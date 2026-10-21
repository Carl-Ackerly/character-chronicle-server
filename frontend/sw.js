'use strict';
// Increment the shell version whenever shipped frontend files change.
const CACHE='character-chronicle-shell-v1';
const ASSETS=["index.html","account-context.js","account-sync.js","app.js","class-rules-2024.js","crystal-theme.css","ember-theme.css","icon.svg","invocations-2024.js","manifest.webmanifest","rules.js","spell-index-2024.js","spells-data.js","style.css","subclass-grants-2024.js","subclass-reference-2024.js","theme.js","offline.js"];
const ROOT=new URL('./',self.location.href);
const assetURLs=ASSETS.map(name=>new URL(name,ROOT).href);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(assetURLs.map(url=>new Request(url,{cache:'reload'})))));
 // Existing pages keep their matching shell until they close; no forced reload.
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('character-chronicle-shell-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Authentication, account books and private routes are never cached or replayed.
 if(request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 const relative=url.pathname.slice(ROOT.pathname.length);
 const navigation=request.mode==='navigate'&&(relative===''||relative==='index.html');
 if(!navigation&&!ASSETS.includes(relative))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const match=await cache.match(new URL(navigation?'index.html':relative,ROOT).href);
  // All shell files are installed together. Account data lives only in its
  // existing local storage / authenticated API flow, never in this cache.
  return match||fetch(request);
 })());
});
