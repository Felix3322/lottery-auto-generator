/* Direct PDF: one reusable static ticket form, reusable FE glyphs, bounded worker queue. */
window.TicketPDF=(()=>{
 const SVG='http://www.w3.org/2000/svg';
 const parse=s=>new DOMParser().parseFromString(s,'image/svg+xml').documentElement;
 function pool(f){
  if(!f.securityEnabled)return {get:async()=>null,close(){}};
  if(location.protocol==='file:'||!('Worker' in window))return {get:async number=>{const item=await TicketCrypto.ensure(f,number),pixels=new Uint8Array(item.modules*item.modules);for(const m of item.path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)){const x=+m[1],y=+m[2],length=+m[3];pixels.fill(1,y*item.modules+x,y*item.modules+x+length);}return {...item,pixels};},close(){}};
  const workers=[],queue=[];let id=0,closed=false;
  const settings=TicketCrypto.batchKey(f);
  function pump(slot){if(closed||!slot.ready||slot.task||!queue.length)return;slot.task=queue.shift();slot.worker.postMessage({id:++id,number:slot.task.number});}
  const fail=error=>{closed=true;for(const slot of workers){slot.worker.terminate();slot.task?.reject(error);}for(const task of queue.splice(0))task.reject(error);};
  for(let i=0;i<Math.min(4,Math.max(1,(navigator.hardwareConcurrency||2)-1));i++){
   const slot={worker:new Worker('./pdf-worker.js?v=20261022-2'),ready:false,task:null};workers.push(slot);
   slot.worker.onmessage=({data})=>{if(data.error){fail(Error(data.error));return;}if(data.ready)slot.ready=true;else{slot.task.resolve(data);slot.task=null;}pump(slot);};
   slot.worker.onerror=()=>fail(Error('PDF signing worker failed. Retry with a locally served or HTTPS copy.'));
   slot.worker.postMessage({init:settings});
  }
  return {get:number=>new Promise((resolve,reject)=>{if(closed){reject(Error('PDF generation stopped.'));return;}queue.push({number,resolve,reject});workers.forEach(pump);}),close:()=>fail(Error('PDF generation stopped.'))};
 }
 async function staticArtwork(f){
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;width:1200px;visibility:hidden';host.innerHTML=fittedSvg({...f,backgroundTheme:'white'},'0000');document.body.append(host);
  const svg=host.firstElementChild;
  const headers=[...svg.querySelectorAll('[data-ticket-number]')].map(n=>({x:+n.getAttribute('x'),y:+n.getAttribute('y'),width:+n.dataset.maxWidth,anchor:n.getAttribute('text-anchor')||'start'}));
  svg.querySelectorAll('[data-ticket-number],[data-secure-permit],[data-secure-serial],[data-auth-band]').forEach(n=>n.remove());
  try{
   // Rasterize fixed labels only once at high resolution, preserving installed fonts/Unicode.
   for(const node of [...svg.querySelectorAll('text')]){
    const box=node.getBBox(),style=getComputedStyle(node),canvas=document.createElement('canvas'),pad=3;
    canvas.width=Math.max(1,Math.ceil((box.width+pad*2)*2));canvas.height=Math.max(1,Math.ceil((box.height+pad*2)*2));
    const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fillStyle=style.fill;ctx.textAlign=({start:'left',middle:'center',end:'right'})[node.getAttribute('text-anchor')||'start'];
    if('letterSpacing' in ctx)ctx.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
    ctx.fillText(node.textContent,+node.getAttribute('x')-box.x+pad,+node.getAttribute('y')-box.y+pad);
    const img=document.createElementNS(SVG,'image');for(const [k,v]of Object.entries({x:box.x-pad,y:box.y-pad,width:box.width+pad*2,height:box.height+pad*2,href:canvas.toDataURL('image/png')}))img.setAttribute(k,v);node.replaceWith(img);
   }
   const images=[...svg.querySelectorAll('image[filter]')];
   for(const node of images){const image=new Image();image.src=node.getAttribute('href');await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.filter='grayscale(1)';ctx.drawImage(image,0,0);node.setAttribute('href',canvas.toDataURL('image/png'));node.removeAttribute('filter');}
   return {svg:svg.cloneNode(true),headers};
  }finally{host.remove();}
 }
 async function generate(snapshot,onProgress=()=>{},cancelled=()=>false){
  const f={...snapshot.form,backgroundTheme:'white'},numbers=snapshot.numbers,l=getPrintLayout(f);
  TicketSecurity.validateNumbers(f,numbers);if(!l.perPage)throw Error('Ticket does not fit the selected paper.');
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:[l.pw,l.ph],orientation:l.pw>l.ph?'landscape':'portrait',compress:true,putOnlyUsedFonts:true});
  const signer=pool(f),pending=new Map(),formKeys=new Set();let next=0;
  function refill(){while(next<numbers.length&&pending.size<12){const i=next++;pending.set(i,signer.get(numbers[i]).then(value=>({value}),error=>({error})));}}
  const check=()=>{if(cancelled())throw Error('PDF export cancelled. No partial PDF was downloaded.');};
  async function makeForm(key,svg,w,h){doc.advancedAPI();doc.beginFormObject(0,0,w,h,new doc.Matrix(1,0,0,1,0,0));doc.saveGraphicsState();await doc.svg(svg,{x:0,y:0,width:w,height:h});doc.endFormObject(key);doc.restoreGraphicsState();doc.compatAPI();formKeys.add(key);}
  function useForm(key,x,y,scale){doc.advancedAPI();doc.doFormObject(key,new doc.Matrix(scale,0,0,scale,x,y));doc.compatAPI();}
  async function number(value,x,y,height,maxWidth){
   const chars=Array.from(String(value)),width=SecureNumbers.measure(value),scale=Math.min(height/70,maxWidth/width),seed=chars.reduce((h,c)=>(Math.imul(h,31)+c.codePointAt(0))>>>0,0),pattern=`pattern-${width}-${seed%7}`;
   if(!formKeys.has(pattern)){const all=parse(`<svg xmlns="${SVG}" viewBox="0 0 ${width} 70">${SecureNumbers.draw(value,width,70)}</svg>`);all.querySelectorAll('g[fill]').forEach(n=>n.remove());await makeForm(pattern,all,width,70);}
   useForm(pattern,x,y,scale);let cursor=8;
   for(const c of chars){const glyph=SecureNumbers.glyphs[c],key='glyph-'+c.codePointAt(0);if(!glyph)throw Error(`FE-Schrift does not contain character ${c}. Use supported ticket-number characters.`);
    if(!formKeys.has(key)){const advance=glyph.advance*SecureNumbers.units+2;await makeForm(key,parse(`<svg xmlns="${SVG}" viewBox="0 0 ${advance} 70"><path d="${glyph.path}" fill="#303030" transform="translate(0 60) scale(${SecureNumbers.units} -${SecureNumbers.units})"/></svg>`),advance,70);}
    useForm(key,x+cursor*scale,y,scale);cursor+=glyph.advance*SecureNumbers.units+2;
   }
  }
  try{
   onProgress(0,numbers.length);refill();const base=await staticArtwork(f);check();await makeForm('ticket-base',base.svg,3000,1000);
   for(let start=0;start<numbers.length;start+=l.perPage){
    check();if(start)doc.addPage([l.pw,l.ph],l.pw>l.ph?'landscape':'portrait');const xs=new Set(),ys=new Set();
    for(let offset=0;offset<l.perPage&&start+offset<numbers.length;offset++){
     check();const i=start+offset,result=await pending.get(i);pending.delete(i);refill();if(result.error)throw result.error;const item=result.value,value=String(numbers[i]),x=l.m+(offset%l.cols)*(l.w+l.g),y=l.m+Math.floor(offset/l.cols)*(l.h+l.g),s=l.w/3000;
     if(item&&l.w<Math.ceil(item.modules*.3*3000/610))throw Error('Increase ticket width for a scannable signed QR.');
     useForm('ticket-base',x,y,s);
     doc.setFont('helvetica','bold');doc.setTextColor(32);
     for(const header of base.headers){doc.setTextColor(header.x>850?255:32);doc.setFontSize(76*s*72/25.4);const size=doc.getFontSize()*Math.min(1,header.width*s/Math.max(.001,doc.getTextWidth(value)));doc.setFontSize(size);doc.text(value,x+header.x*s,y+header.y*s,{align:header.anchor==='end'?'right':'left'});}
     const h=numberStripHeight(f,value);
     await number(f.permitNumber,x+55*s,y+899*s,h*s,390*s);await number(value,x+490*s,y+899*s,h*s,300*s);
     await number(f.permitNumber,x+935*s,y+899*s,h*s,390*s);await number(value,x+2260*s,y+899*s,h*s,650*s);
     if(item){const canvas=document.createElement('canvas');canvas.width=canvas.height=item.modules;const ctx=canvas.getContext('2d'),image=ctx.createImageData(item.modules,item.modules);for(let k=0;k<item.pixels.length;k++){const v=item.pixels[k]?0:255;image.data[k*4]=image.data[k*4+1]=image.data[k*4+2]=v;image.data[k*4+3]=255;}ctx.putImageData(image,0,0);doc.addImage(canvas.toDataURL('image/png'),'PNG',x+2335*s,y+234*s,610*s,610*s,undefined,'FAST');}
     xs.add(x);xs.add(x+l.w);ys.add(y);ys.add(y+l.h);
    }
    if(f.cropMarks==='yes'){doc.setDrawColor(51);doc.setLineWidth(.15);for(const x of xs)doc.line(x,0,x,l.ph);for(const y of ys)doc.line(0,y,l.pw,y);}
    onProgress(Math.min(start+l.perPage,numbers.length),numbers.length);await pause(0);
   }
   check();return doc.output('blob');
  }finally{signer.close();}
 }
 async function download(current=false){
  if(outputBusy)return;const snapshot=getSnapshotForOutput();if(current)snapshot.numbers=[snapshot.numbers[state.previewIndex]||snapshot.numbers[0]];
  cancelOutput=false;setOutputBusy(true);const start=performance.now();
  try{const blob=await generate(snapshot,(n,total)=>actionStatus.textContent=`Preparing PDF: ${n.toLocaleString()} / ${total.toLocaleString()} tickets…`,()=>cancelOutput);downloadBlob(blob,'raffle-tickets.pdf');actionStatus.textContent=`PDF ready: ${snapshot.numbers.length.toLocaleString()} tickets in ${((performance.now()-start)/1000).toFixed(1)} seconds. Print at 100% / Actual size.`;}
  catch(e){actionStatus.textContent=e.message||'PDF export failed.';}finally{setOutputBusy(false);}
 }
 return {generate,download};
})();
