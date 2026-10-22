/* Matching readable type and decorative loop engraving on both ticket halves.
   Authenticity is verified separately by the signed QR. */
window.SecureNumbers = (() => {
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function draw(value,maxWidth,height=90) {
    const chars=Array.from(String(value)), width=Math.max(1,chars.length)*34+16;
    const scale=Math.min(height/70,maxWidth/width);
    const seed=chars.reduce((h,c)=>(Math.imul(h,31)+c.codePointAt(0))>>>0,0);
    const bend=18+seed%7,loops=[];
    for(let x=24;x<width-23;x+=7) loops.push(`M${x} 35C${x-bend} 2 ${x+bend} 2 ${x} 35C${x-bend} 68 ${x+bend} 68 ${x} 35Z`);
    return `<g data-secure-number="${esc(value)}" transform="scale(${scale})">
      <path data-loop-engraving="true" d="${loops.join(' ')}" fill="none" stroke="#c3c3c3" stroke-width="1.5"/>
      <text x="8" y="54" fill="#303030" font-size="54" style="font-family:Consolas,'Courier New',monospace;font-weight:400;font-variant-numeric:tabular-nums;letter-spacing:1px">${esc(value)}</text>
    </g>`;
  }
  return {draw};
})();
