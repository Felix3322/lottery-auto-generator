const CACHE='raffle-offline-v6';
const FILES=['./','./index.html','./verify.html','./secure-number.js','./ticket-crypto.js','./issuer.js','./verify.js','./offline.js','./vendor/qrcode.js','./vendor/jsQR.js','./FONT-CREDITS.txt','./SECURITY-GUIDE.txt'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('raffle-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  const clean=new URL(event.request.url);clean.search='';
  const allowed=FILES.some(file=>new URL(file,self.registration.scope).pathname===clean.pathname);
  if(!allowed)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(clean.href,response.clone()));return response;}).catch(()=>caches.match(clean.href)));
});
