importScripts('./vendor/qrcode.js');
const enc=new TextEncoder();
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
let settings;
self.onmessage=async({data})=>{try{
 if(data.init){settings={...data.init,hash:b64(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify(data.init.context))))};postMessage({ready:true});return;}
 const number=String(data.number);if(!number||number.length>256)throw Error('Signed ticket numbers must contain 1–256 characters.');
 const body=[1,settings.context[0],number,settings.keyId,settings.hash],message='RFL1.'+b64(enc.encode(JSON.stringify(body)));
 const token=message+'.'+b64(await crypto.subtle.sign('Ed25519',settings.privateKey,enc.encode(message)));
 const qr=qrcode(0,'M');qr.addData(token,'Byte');qr.make();const count=qr.getModuleCount(),modules=count+8,pixels=new Uint8Array(modules*modules);
 for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))pixels[(y+4)*modules+x+4]=1;
 postMessage({id:data.id,modules,pixels,token},[pixels.buffer]);
}catch(e){postMessage({id:data.id,error:e.message});}};
