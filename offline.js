(() => {
  const status=document.getElementById('offlineStatus');
  if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol)){
    if(status)status.textContent='Local copy: keep all files together. Camera access may require HTTPS; QR photo verification works without a server.';return;
  }
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{
    if(status)status.textContent='Ready for offline use on this device. Before the event: import the public file, test a ticket, and confirm the page reloads in airplane mode.';
  }).catch(()=>{if(status)status.textContent='Offline cache could not be prepared. Use the downloaded offline copy or keep this page open.';});
})();
