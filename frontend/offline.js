(() => {
 'use strict';
 const message=document.createElement('p');message.className='small offline-status';message.setAttribute('role','status');message.hidden=true;document.querySelector('main').before(message);
 function connection(){message.hidden=navigator.onLine;if(!navigator.onLine)message.textContent='Offline · device-only characters remain available. Account sign-in and syncing need the server.';}
 window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
 if(!('serviceWorker' in navigator)){message.hidden=false;message.textContent='This browser cannot enable offline loading. The server is needed to reopen the app.';return;}
 navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>{
  const ready=document.createElement('span');ready.id='offlineReady';ready.textContent=' · Offline loading ready';document.querySelector('footer')?.append(ready);
 }).catch(()=>{message.hidden=false;message.textContent='Offline setup could not finish. Keep the server available and reopen the app to retry.';});
})();
