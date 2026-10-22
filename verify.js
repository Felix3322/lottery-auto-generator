(() => {
  const el=id=>document.getElementById(id);
  let trusted=null,verified=null,revision=0,stream=null,scanning=false,busy=false;
  function status(text,kind=''){el('result').textContent=text;el('result').className='status '+kind;}
  function invalidate(){revision++;verified=null;el('redeemBtn').disabled=true;el('matchPrinted').checked=false;el('matchPrinted').disabled=true;el('ticketDetails').hidden=true;}
  const dbReady=new Promise((resolve,reject)=>{
    const request=indexedDB.open('raffle-redemptions-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('redemptions',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Local redemption storage is unavailable.'));
  });
  async function getRecord(id){const db=await dbReady;return new Promise((resolve,reject)=>{const r=db.transaction('redemptions').objectStore('redemptions').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function addRecord(record){const db=await dbReady;return new Promise((resolve,reject)=>{const tx=db.transaction('redemptions','readwrite');tx.objectStore('redemptions').add(record);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error(tx.error?.name==='ConstraintError'?'ALREADY REDEEMED on this device.':'Could not save redemption. Do not pay out until it is recorded.'));});}
  async function allRecords(){const db=await dbReady;return new Promise((resolve,reject)=>{const r=db.transaction('redemptions').objectStore('redemptions').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  function download(data,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  async function readJSON(file,max=100000){if(!file||file.size>max)throw Error('File missing or too large.');return JSON.parse(await file.text());}
  el('publicFile').addEventListener('change',async()=>{
    invalidate();trusted=null;el('keyStatus').textContent='Loading…';el('fingerprint').textContent='';const rev=revision;
    try{const loaded=await TicketCrypto.loadPublic(await readJSON(el('publicFile').files[0]));if(rev!==revision)return;trusted=loaded;el('keyStatus').textContent=`Trusted batch: ${trusted.context[0]}`;el('fingerprint').textContent=`Public key fingerprint: ${trusted.keyId}`;status('Public issuer file loaded. Scan a ticket.');}catch(e){if(rev===revision){el('keyStatus').textContent='No trusted issuer loaded.';status(e.message,'bad');}}
  });
  el('qrText').addEventListener('input',()=>{invalidate();status('Input changed. Verify again.');});
  async function verifyCurrent(){invalidate();const rev=revision,token=el('qrText').value.trim(),authority=trusted;status('Checking signature and local redemption history…');
    try{
      const ticket=await TicketCrypto.verify(token,authority),existing=await getRecord(ticket.id);if(rev!==revision)return;
      const fields=[['Number',ticket.number],['Batch',ticket.batch],['Permit',ticket.context[1]],['Event',ticket.context[2]],['Prize',ticket.context[3]],['Draw date',ticket.context[4]],['Location',ticket.context[5]],['Description',ticket.context[6]],['Ticket terms',ticket.context[7]]];
      el('ticketDetails').replaceChildren();for(const [k,v]of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;el('ticketDetails').append(dt,dd);}el('ticketDetails').hidden=false;
      if(existing){status(`VALID SIGNATURE · ALREADY REDEEMED\nRecorded: ${existing.redeemedAt}`,'bad');return;}
      verified=ticket;el('matchPrinted').disabled=false;status('VALID SIGNATURE · Not yet redeemed on this device.\nCompare the printed ticket with the verified fields below.','good');
    }catch(e){if(rev===revision)status(e.message,'bad');}
  }
  el('verifyBtn').addEventListener('click',verifyCurrent);
  el('matchPrinted').addEventListener('change',()=>el('redeemBtn').disabled=!verified||!el('matchPrinted').checked||busy);
  el('redeemBtn').addEventListener('click',async()=>{
    if(busy||!verified||!el('matchPrinted').checked)return;
    busy=true;el('redeemBtn').disabled=true;const ticket=verified,rev=revision;
    try{
      if(el('qrText').value.trim()!==ticket.token)throw Error('Ticket changed. Verify again.');
      const current=await TicketCrypto.verify(ticket.token,trusted);if(rev!==revision)throw Error('Issuer or ticket changed. Verify again.');
      const redeemedAt=new Date().toISOString();await addRecord({id:current.id,token:current.token,redeemedAt});
      if(rev===revision){invalidate();status(`REDEEMED · Ticket ${current.number}\nRecorded locally: ${redeemedAt}`,'good');}
    }catch(e){if(rev===revision){invalidate();status(e.message,'bad');}}finally{busy=false;}
  });
  function stopCamera(){scanning=false;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;el('camera').srcObject=null;el('camera').hidden=true;el('stopCameraBtn').hidden=true;el('cameraBtn').disabled=false;}
  async function acceptScan(text){stopCamera();el('qrText').value=text;await verifyCurrent();}
  function decodeCanvas(canvas){const ctx=canvas.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,canvas.width,canvas.height);return jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'});}
  el('cameraBtn').addEventListener('click',async()=>{
    if(!trusted){status('Import the trusted public issuer file first.','bad');return;}
    try{el('cameraBtn').disabled=true;stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});const video=el('camera');video.srcObject=stream;video.hidden=false;el('stopCameraBtn').hidden=false;await video.play();scanning=true;
      const canvas=document.createElement('canvas');async function tick(){if(!scanning)return;if(video.videoWidth){const scale=Math.min(1,1200/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const result=decodeCanvas(canvas);if(result){await acceptScan(result.data);return;}}setTimeout(tick,160);}tick();
    }catch(e){stopCamera();status(`Camera unavailable: ${e.message}. Use a QR photo or paste its contents.`,'bad');}
  });
  el('stopCameraBtn').addEventListener('click',stopCamera);window.addEventListener('pagehide',stopCamera);
  el('qrImage').addEventListener('change',async()=>{invalidate();try{const file=el('qrImage').files[0];if(!file||file.size>20000000)throw Error('Select an image smaller than 20 MB.');const img=await createImageBitmap(file),canvas=document.createElement('canvas');const scale=Math.min(1,2400/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close();const result=decodeCanvas(canvas);if(!result)throw Error('No readable QR found. Try a sharper, closer photo.');await acceptScan(result.data);}catch(e){status(e.message,'bad');}});
  el('exportLogBtn').addEventListener('click',async()=>{try{const records=await allRecords();download({format:'raffle-redemption-log-v1',records},'raffle-redemptions.json');el('logStatus').textContent=`Exported ${records.length} redemption records.`;}catch(e){el('logStatus').textContent=e.message;}});
  el('importLog').addEventListener('change',async()=>{try{const bundle=await readJSON(el('importLog').files[0],20000000);if(bundle.format!=='raffle-redemption-log-v1'||!Array.isArray(bundle.records)||bundle.records.length>20000)throw Error('Invalid redemption log.');const authority=trusted;if(!authority)throw Error('Load the public issuer file first.');let added=0,skipped=0;for(const record of bundle.records){const ticket=await TicketCrypto.verify(record.token,authority);if(await getRecord(ticket.id)){skipped++;continue;}try{await addRecord({id:ticket.id,token:ticket.token,redeemedAt:new Date().toISOString(),restored:true});added++;}catch(e){if(await getRecord(ticket.id))skipped++;else throw e;}}invalidate();el('logStatus').textContent=`Added ${added}; already present ${skipped}. Only this device’s log was updated.`;}catch(e){el('logStatus').textContent=e.message;}});
})();
