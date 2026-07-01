const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const res = await page.evaluate(() => {
    const RID=10000000;
    const c=document.createElement('canvas');c.width=48;c.height=48;const cx=c.getContext('2d');cx.fillStyle='#09f';cx.fillRect(0,0,48,48);cx.fillStyle='#fff';cx.font='bold 24px sans-serif';cx.fillText('B',16,33);
    const escudo=c.toDataURL('image/png');

    leagues.push({id:5,name:'Mi Liga Real',sport:'Fútbol',color:'#1a3d20',icon:'⚽',_real:true});
    torneos.push({id:3+RID,_rid:3,leagueId:5,name:'Apertura 2026',status:'active',start:'2026',divsCount:0,logoUrl:null});
    divisiones.push({id:10+RID,_rid:10,torneoId:3+RID,name:'Primera',grupo:'Mayores',teams:2,rounds:10,currentRound:0,icon:'📋'});
    // Boca has an escudo (club logo), River does not
    teamsData.push({id:50+RID,name:'Boca Real',short:'BR',color:'#003',text:'#fff',logoUrl:escudo});
    teamsData.push({id:51+RID,name:'River Real',short:'RR',color:'#a00',text:'#fff',logoUrl:null});
    standings.push({teamId:50+RID,divId:10+RID,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0});
    standings.push({teamId:51+RID,divId:10+RID,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0});

    _dtExpLigas.add(5);
    _dtShowTorneoCenter(3+RID);
    const shieldImgs = document.querySelectorAll('#vtd-content .vtd-shield img');
    const tableLogoOk = shieldImgs.length===1 && shieldImgs[0].getAttribute('src').startsWith('data:image/');
    // River still shows text short (no logo)
    const riverShield = Array.from(document.querySelectorAll('#vtd-content .vtd-st-row')).find(r=>r.textContent.includes('River Real'))?.querySelector('.vtd-shield');
    const riverShowsText = riverShield && !riverShield.querySelector('img') && riverShield.textContent.trim()==='RR';

    // Club summary (right panel) via _dtClickClub
    _dtClickClub(50+RID);
    const summaryImg = document.querySelector('#dt-rc .shield img');
    const summaryOk = !!summaryImg && summaryImg.getAttribute('src').startsWith('data:image/');

    // Full club card via _dtDblClickClub
    _dtDblClickClub(50+RID);
    const fullImg = document.querySelector('#vcd-content .shield img');
    const fullOk = !!fullImg && fullImg.getAttribute('src').startsWith('data:image/');

    return { tableLogoOk, tableShieldImgs: shieldImgs.length, riverShowsText, summaryOk, fullOk };
  });

  console.log('=== TEAM ESCUDO ===');
  console.log(JSON.stringify(res, null, 2));
  console.log(res.tableLogoOk ? '✅ Standings table: escudo shown for team with logo' : '❌ table logo');
  console.log(res.riverShowsText ? '✅ Team without logo: still shows sigla (RR)' : '❌ fallback');
  console.log(res.summaryOk ? '✅ Club summary (right panel): escudo shown' : '❌ summary logo');
  console.log(res.fullOk ? '✅ Full club card: escudo shown' : '❌ full card logo');

  console.log('\n=== JS ERRORS ===');
  console.log(errors.length===0 ? '✅ No JS errors' : errors.map(e=>'❌ '+e).join('\n'));

  await page.evaluate(()=>{ _dtShowTorneoCenter(3+10000000); _dtClickClub(50+10000000); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/home/user/Liga/eslogo_01.png' });
  await browser.close();
})().catch(e=>console.error('FATAL:', e.message));
