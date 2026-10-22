const CACHE='raffle-offline-v13';
const FILES=['./','./index.html','./verify.html','./secure-number.js?v=20261022-2','./ticket-crypto.js?v=20261022-2','./issuer.js?v=20261022-2','./pdf-export.js?v=20261022-2','./pdf-worker.js?v=20261022-2','./vendor/jspdf.umd.min.js?v=20261022-2','./vendor/svg2pdf.umd.min.js?v=20261022-2','./verify.js?v=20261022-2','./offline.js?v=20261022-2','./vendor/qrcode.js?v=20261022-2','./vendor/jsQR.js?v=20261022-2','./FONT-CREDITS.txt','./SECURITY-GUIDE.txt'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('raffle-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  const url=new URL(event.request.url);
  const allowed=FILES.some(file=>new URL(file,self.registration.scope).href===url.href);
  if(!allowed)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // Never substitute an unversioned/older response for a versioned script.
    if(url.searchParams.has('v')){
      const saved=await cache.match(event.request);if(saved)return saved;
    }
    try{
      const response=await fetch(event.request);
      if(response.ok)await cache.put(event.request,response.clone());
      return response;
    }catch(error){const saved=await cache.match(event.request);if(saved)return saved;throw error;}
  })());
});
