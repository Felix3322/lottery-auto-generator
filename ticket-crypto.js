/* Offline protocol: Ed25519 signature over ASCII "RFL1." + Base64url(JSON payload).
   Trusted public keys and event context come from a separately imported issuer file,
   never from the scanned QR. Private keys are held in memory, not browser storage. */
window.TicketCrypto = (() => {
  const enc=new TextEncoder(), dec=new TextDecoder('utf-8',{fatal:true});
  const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const unb64 = s => {
    if(typeof s!=='string'||s.length>12000||!/^[A-Za-z0-9_-]+$/.test(s)) throw Error('Invalid encoded data.');
    const bytes=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
    if(b64(bytes)!==s) throw Error('Non-canonical encoded data.');
    return bytes;
  };
  const digest = async value => b64(await crypto.subtle.digest('SHA-256',enc.encode(value)));
  const context = f => [String(f.batchId||'').trim(),String(f.permitNumber||''),String(f.schoolName||''),String(f.prizeAmount||''),String(f.drawDateLine||''),String(f.drawLocationLine||''),String(f.descriptionText||''),String(f.footerSummary||'')];
  function checkContext(c) {
    if(!Array.isArray(c)||c.length!==8||c.some(v=>typeof v!=='string'||v.length>2000)||!c[0]||c[0].length>100) throw Error('Invalid batch/event context.');
    return c;
  }
  async function loadPublic(bundle) {
    if(bundle?.format!=='raffle-public-v1') throw Error('Select the issuer’s public verification file.');
    const raw=unb64(bundle.publicKey);if(raw.length!==32)throw Error('Invalid Ed25519 public key.');
    const publicKey=await crypto.subtle.importKey('raw',raw,'Ed25519',false,['verify']);
    const keyId=await digest(bundle.publicKey),ctx=checkContext(bundle.context);
    return {publicKey,publicRaw:bundle.publicKey,keyId,context:ctx,contextHash:await digest(JSON.stringify(ctx))};
  }
  async function verify(token, trusted) {
    if(!trusted?.publicKey) throw Error('Import a trusted issuer public file first.');
    if(typeof token!=='string'||token.length>4096)throw Error('Invalid QR payload.');
    const parts=token.trim().split('.');if(parts.length!==3||parts[0]!=='RFL1')throw Error('This is not a supported signed raffle QR.');
    const signature=unb64(parts[2]);if(signature.length!==64)throw Error('Invalid signature length.');
    const valid=await crypto.subtle.verify('Ed25519',trusted.publicKey,signature,enc.encode('RFL1.'+parts[1]));
    if(!valid)throw Error('INVALID SIGNATURE — ticket data has changed or the issuer key is wrong.');
    const body=JSON.parse(dec.decode(unb64(parts[1])));
    if(!Array.isArray(body)||body.length!==5||body[0]!==1||body.some((v,i)=>i>0&&typeof v!=='string')||!body[2]||body[2].length>256)throw Error('Invalid signed ticket fields.');
    if(body[1]!==trusted.context[0]||body[3]!==trusted.keyId||body[4]!==trusted.contextHash)throw Error('Signed ticket belongs to a different batch or event. Import the correct public file.');
    return {batch:body[1],number:body[2],keyId:body[3],context:trusted.context,token:token.trim(),id:JSON.stringify([body[3],body[1],body[2]])};
  }
  let issuer=null;
  const cache=new Map(),pending=new Map();
  async function generate() {
    const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
    const raw=b64(await crypto.subtle.exportKey('raw',pair.publicKey));
    issuer={...pair,publicRaw:raw,keyId:await digest(raw)};cache.clear();pending.clear();return issuer.keyId;
  }
  async function importIssuer(bundle) {
    if(bundle?.format!=='raffle-issuer-private-v1')throw Error('Select an issuer PRIVATE key file.');
    const trusted=await loadPublic({format:'raffle-public-v1',publicKey:bundle.publicKey,context:bundle.context});
    const privateKey=await crypto.subtle.importKey('pkcs8',unb64(bundle.privateKey),'Ed25519',true,['sign']);
    const challenge=crypto.getRandomValues(new Uint8Array(32));
    const proof=await crypto.subtle.sign('Ed25519',privateKey,challenge);
    if(!await crypto.subtle.verify('Ed25519',trusted.publicKey,proof,challenge))throw Error('Private/public key mismatch.');
    issuer={privateKey,publicKey:trusted.publicKey,publicRaw:bundle.publicKey,keyId:trusted.keyId};cache.clear();pending.clear();return trusted.context;
  }
  async function exportPublic(f) {
    if(!issuer)throw Error('Generate or import an issuer key first.');
    return {format:'raffle-public-v1',algorithm:'Ed25519',publicKey:issuer.publicRaw,context:checkContext(context(f))};
  }
  async function exportPrivate(f) {
    const pub=await exportPublic(f);
    return {...pub,format:'raffle-issuer-private-v1',privateKey:b64(await crypto.subtle.exportKey('pkcs8',issuer.privateKey))};
  }
  const cacheKey=(f,n)=>JSON.stringify([issuer?.keyId,context(f),String(n)]);
  function cached(f,n){return cache.get(cacheKey(f,n));}
  async function ensure(f,n) {
    if(!f.securityEnabled)return null;
    if(!issuer)throw Error('Signed QR is enabled. Generate or import an issuer private key first.');
    const number=String(n);if(!number||number.length>256)throw Error('Signed ticket numbers must contain 1–256 characters.');
    const ctx=checkContext(context(f)),key=cacheKey(f,n),signer=issuer;
    let item=cache.get(key);
    if(!item) {
      if(!pending.has(key)) pending.set(key,(async()=>{
        const body=[1,ctx[0],number,signer.keyId,await digest(JSON.stringify(ctx))];
        const encoded=b64(enc.encode(JSON.stringify(body))),message='RFL1.'+encoded;
        const signature=await crypto.subtle.sign('Ed25519',signer.privateKey,enc.encode(message));
        const token=message+'.'+b64(signature);
        const qr=qrcode(0,'M');qr.addData(token,'Byte');qr.make();
        const count=qr.getModuleCount(),paths=[];
        for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))paths.push(`M${x+4} ${y+4}h1v1h-1z`);
        const entry={token,modules:count+8,path:paths.join(''),keyId:signer.keyId};
        cache.set(key,entry);if(cache.size>128)cache.delete(cache.keys().next().value);return entry;
      })());
      try {item=await pending.get(key);}finally{pending.delete(key);}
    }
    const minWidth=Math.ceil(item.modules*.3*3000/540);
    if(f.ticketWidth<minWidth)throw Error(`Increase ticket width to at least ${minWidth} mm for a scannable QR (0.30 mm modules).`);
    return item;
  }
  return {b64,unb64,digest,context,loadPublic,verify,generate,importIssuer,exportPublic,exportPrivate,ensure,cached,get ready(){return !!issuer},get keyId(){return issuer?.keyId||''}};
})();
