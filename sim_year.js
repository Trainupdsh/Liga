const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true });
  const p = await (await b.newContext()).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:4330/prototipo.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(900);
  const r = await p.evaluate(()=>({ year: document.getElementById('footer-year')?.textContent, expected: String(new Date().getFullYear()) }));
  console.log(JSON.stringify(r));
  console.log(r.year===r.expected ? '✅ footer year dynamic = '+r.year : '❌ '+r.year);
  console.log(errs.length===0?'✅ No JS errors':errs.join('\n'));
  await b.close();
})().catch(e=>console.error('FATAL:',e.message));
