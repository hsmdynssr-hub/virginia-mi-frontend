'use strict';
const CACHE='virginia-workspace-shell-v6-controlled-pilot';
const SHELL=['/workspace/','/workspace/index.html','/workspace/styles.css','/workspace/app.js','/workspace/collaboration.js','/workspace/pagination.js','/workspace/config.js','/workspace/icon.svg','/workspace/icon-192.png','/workspace/icon-512.png','/workspace/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('virginia-workspace-shell-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Never cache invitations, identities, credentials, messages, admin pages or API responses.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||!SHELL.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request)));
});
