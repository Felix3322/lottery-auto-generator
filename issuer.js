window.TicketSecurity = (() => {
  const el=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let previewJob=0,previewTimer,keyBusy=false;
  const ratio=()=>3;
  function band(f,number) {
    if(!f.securityEnabled)return '';
    const item=TicketCrypto.cached(f,number);
    const qr=item?`<svg data-signed-qr="true" data-token="${esc(item.token)}" x="2330" y="234" width="620" height="620" viewBox="0 0 ${item.modules} ${item.modules}"><rect width="${item.modules}" height="${item.modules}" fill="#fff"/><path d="${item.path}" fill="#000" shape-rendering="crispEdges"/></svg>`:`<rect x="2330" y="234" width="620" height="620" fill="#f5f5f5" stroke="#ccc" stroke-width="2"/><text x="2640" y="554" text-anchor="middle" font-size="28" fill="#555">UNSIGNED PREVIEW</text>`;
    return `<g data-auth-band="true">${qr}</g>`;
  }
  function outputAllowed(f){return !f.securityEnabled||TicketCrypto.ready;}
  function gate(){
    if(!state?.form)return;
    const blocked=outputBusy||!state.generatedNumbers.length||!outputAllowed(state.form);
    for(const button of [printCurrentBtn,printBatchBtn,exportCurrentBtn,exportBatchBtn,...document.querySelectorAll('[data-forward]')])button.disabled=blocked || (button.id.startsWith('print')&&!getPrintLayout(state.form).perPage);
  }
  function schedule() {
    gate();clearTimeout(previewTimer);const job=++previewJob;
    if(!state.form.securityEnabled)return;
    if(!TicketCrypto.ready){el('signingStatus').textContent='Signed QR is enabled. Generate or import a private issuer key before printing.';return;}
    const f={...state.form},count=Math.min(state.generatedNumbers.length,getPrintLayout(f).perPage),numbers=new Set([state.generatedNumbers[state.previewIndex]]);
    for(let i=0;i<count;i++)numbers.add(state.generatedNumbers[i]);
    const missing=[...numbers].filter(n=>n!==undefined&&!TicketCrypto.cached(f,n));
    if(!missing.length)return;
    previewTimer=setTimeout(async()=>{try{
      for(const number of missing)await TicketCrypto.ensure(f,number);
      if(job!==previewJob)return;
      el('signingStatus').textContent=`Signed preview ready. Public key: ${TicketCrypto.keyId.slice(0,16)}…`;
      renderPreview();
    }catch(e){if(job===previewJob)el('signingStatus').textContent=e.message;}},100);
  }
  function validateNumbers(f,numbers) {
    if(!f.securityEnabled)return;
    if(!TicketCrypto.ready)throw Error('Generate or import an issuer private key before printing signed tickets.');
    if(f.customNumbers?.trim()){const custom=f.customNumbers.split(/[\n,，;；]+/).map(s=>s.trim()).filter(Boolean);if(new Set(custom).size!==custom.length)throw Error('Signed batches require unique ticket numbers. Remove duplicate custom numbers.');}
    if(!numbers.length)throw Error('No ticket numbers selected.');
  }
  function jsonDownload(data,name){downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name);}
  async function keyAction(task){if(outputBusy||keyBusy)return;keyBusy=true;el('generateKeyBtn').disabled=true;try{await task();}catch(e){el('signingStatus').textContent=e.message;}finally{keyBusy=false;el('generateKeyBtn').disabled=false;renderAll();}}
  function init(){
    if(!form.batchId.value)form.batchId.value=TicketCrypto.b64(crypto.getRandomValues(new Uint8Array(12)));
    el('generateKeyBtn').addEventListener('click',()=>keyAction(async()=>{
      if(TicketCrypto.ready&&!confirm('Replace the signing key in memory? Previously issued tickets still require their original public file.'))return;
      const id=await TicketCrypto.generate();el('signingStatus').textContent=`New key generated (${id.slice(0,16)}…). Download the PRIVATE issuer backup before closing this page. Keys are not saved in browser storage.`;
    }));
    el('importIssuerKey').addEventListener('change',()=>keyAction(async()=>{
      const file=el('importIssuerKey').files[0];if(!file||file.size>50000)throw Error('Select a valid issuer key JSON file.');
      const ctx=await TicketCrypto.importIssuer(JSON.parse(await file.text()));
      const fields=['batchId','permitNumber','schoolName','prizeAmount','drawDateLine','drawLocationLine','descriptionText','footerSummary'];fields.forEach((name,i)=>form[name].value=ctx[i]);
      el('signingStatus').textContent='Private issuer key and event settings restored. Check the ticket-number range before printing.';
    }));
    el('exportPrivateBtn').addEventListener('click',()=>keyAction(async()=>{jsonDownload(await TicketCrypto.exportPrivate(collectFormState()),'raffle-issuer-PRIVATE.json');el('signingStatus').textContent='Private backup download requested. Keep it with the issuer; never give it to ticket holders or redemption staff.';}));
    el('exportPublicBtn').addEventListener('click',()=>keyAction(async()=>{const bundle=await TicketCrypto.exportPublic(collectFormState());jsonDownload(bundle,'raffle-public-'+sanitizeFilename(bundle.context[0])+'.json');el('signingStatus').textContent='Public verification file download requested. Transfer it directly to the redemption device. Export it again if event settings change.';}));
    renderAll();
  }
  return {ratio,band,schedule,gate,validateNumbers,init};
})();
