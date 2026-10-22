/* Original SVG numeral artwork. FE-Schrift-inspired, not an official FE font. */
window.SecureNumbers = (() => {
  const digits = {
    0: 'M9 0H31L40 9V51L31 60H9L0 51V9ZM12 12V48H28V12Z',
    1: 'M5 11L19 0H28V49H38V60H4V49H16V16L5 24Z',
    2: 'M0 12L10 0H30L40 10V25L13 48H40V60H0V44L28 20V12H12V21H0Z',
    3: 'M0 0H30L40 10V24L34 30L40 37V50L30 60H0V48H26L28 45V37H11V25H28V15L25 12H0Z',
    4: 'M23 0H37V35H42V47H37V60H25V47H0V33ZM25 17L12 35H25Z',
    5: 'M0 0H40V12H12V24H30L40 34V50L30 60H0V48H26L28 45V39L25 36H0Z',
    6: 'M12 0H35V12H16L12 18V25H30L40 35V50L30 60H10L0 50V17ZM12 37V48H28V37Z',
    7: 'M0 0H40V13L23 38V60H11V34L27 12H12V20H0Z',
    8: 'M10 0H30L40 10V24L34 30L40 36V50L30 60H10L0 50V36L6 30L0 24V10ZM12 12V24H28V12ZM12 36V48H28V36Z',
    9: 'M10 0H30L40 10V43L28 60H5V48H24L28 42V35H10L0 25V10ZM12 12V23H28V12Z'
  };
  const cuts = {0:[19,0,3,13],1:[16,33,12,2],2:[26,5,3,9],3:[19,0,3,12],4:[25,49,12,2],5:[19,0,3,12],6:[0,38,12,2],7:[18,0,3,12],8:[28,40,12,2],9:[19,0,3,12]};
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function draw(value,maxWidth,height=72) {
    const chars=Array.from(String(value)), width=Math.max(1,chars.length)*54+16;
    const scale=Math.min(height/74,maxWidth/width);
    const stripes=[];
    for(let x=-74;x<width;x+=22) { const left=Math.max(0,x),right=Math.min(width,x+74); stripes.push(`M${left} ${74-(left-x)}L${right} ${74-(right-x)}`); }
    return `<g data-secure-number="${esc(value)}" transform="scale(${scale})">
      <rect width="${width}" height="74" fill="#181818"/>
      <path d="${stripes.join(' ')}" fill="none" stroke="#fff" stroke-width="4"/>
      ${chars.map((c,i)=>{
        const x=11+i*54, cut=cuts[c];
        const glyph=digits[c] ? `<path d="${digits[c]}" fill-rule="evenodd" fill="#fff" stroke="#181818" stroke-width="4" paint-order="stroke fill"/>` : `<text x="20" y="56" text-anchor="middle" style="font-family:monospace;font-weight:bold" font-size="49" fill="#fff" stroke="#181818" stroke-width="4" paint-order="stroke fill">${esc(c)}</text>`;
        return `<g transform="translate(${x} 7)">${glyph}${cut?`<rect x="${cut[0]}" y="${cut[1]}" width="${cut[2]}" height="${cut[3]}" fill="#181818"/>`:''}</g>`;
      }).join('')}
    </g>`;
  }
  return {draw};
})();
