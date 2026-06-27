const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const warnings = [];
  page.on('console', m => { if(m.type()==='warning') warnings.push(m.text()); });

  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // supa is null in this offline env → uploadImageToStorage throws inside try, hits catch → data URL
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const cx = canvas.getContext('2d');
    cx.fillStyle = '#5b6ef5'; cx.fillRect(0,0,256,256);
    cx.fillStyle = '#fff'; cx.font='bold 80px sans-serif'; cx.fillText('LB',60,150);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp'));

    let out, threw=false, errMsg='';
    try {
      out = await uploadImageToStorage(blob, 'ligas', 'liga_5.webp');
    } catch(e) { threw=true; errMsg=e.message; }

    return {
      supaIsNull: typeof supa === 'object' && supa === null,
      threw, errMsg,
      returnsDataUrl: typeof out === 'string' && out.startsWith('data:image/'),
      kb: out ? Math.round(out.length/1024) : 0,
      prefix: out ? out.slice(0, 24) : '',
    };
  });

  console.log('=== RLS / OFFLINE FALLBACK TEST ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('Warnings:', warnings.filter(w => w.includes('Storage upload failed')));

  if (!result.threw && result.returnsDataUrl) {
    console.log(`✅ PASS: upload doesn't throw; returns inline data URL (~${result.kb} KB)`);
  } else {
    console.log('❌ FAIL: threw=' + result.threw + ' errMsg=' + result.errMsg);
  }

  // Verify the data URL is a valid renderable image
  const renders = await page.evaluate((dataUrl) => new Promise(res => {
    const img = new Image();
    img.onload = () => res({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res({ ok: false });
    img.src = dataUrl;
  }), await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width=256; c.height=256;
    c.getContext('2d').fillRect(0,0,256,256);
    const b = await new Promise(r => c.toBlob(r,'image/webp'));
    return await uploadImageToStorage(b,'ligas','x.webp');
  }));
  console.log('\n=== DATA URL RENDERS AS IMAGE ===');
  console.log(JSON.stringify(renders));
  if (renders.ok && renders.w === 256) console.log('✅ PASS: fallback data URL is a valid 256px image');

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
