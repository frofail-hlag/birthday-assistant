importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME="birthday-assistant-v1-2-3";
const APP_SHELL=["/birthday-assistant/","/birthday-assistant/index.html","/birthday-assistant/style.css","/birthday-assistant/app.js","/birthday-assistant/manifest.json","/birthday-assistant/icons/icon-192.png","/birthday-assistant/icons/icon-512.png"];

self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 event.respondWith(fetch(event.request).then(r=>{const c=r.clone();caches.open(CACHE_NAME).then(x=>x.put(event.request,c));return r}).catch(()=>caches.match(event.request)));
});