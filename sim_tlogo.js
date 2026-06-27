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
    // tiny data-url logo (orange square)
    const c=document.createElement('canvas');c.width=48;c.height=48;const cx=c.getContext('2d');cx.fillStyle='#f90';cx.fillRect(0,0,48,48);
    const logo=c.toDataURL('image/png');

    leagues.push({id:5,name:'Mi Liga Real',sport:'Fútbol',color:'#1a3d20',icon:'⚽',_real:true});
    torneos.push({id:3+RID,_rid:3,leagueId:5,name:'Apertura 2026',status:'active',start:'2026',divsCount:0,logoUrl:logo});
    divisiones.push({id:10+RID,_rid:10,torneoId:3+RID,name:'Primera',grupo:'Mayores',teams:2,rounds:10,currentRound:0,icon:'📋'});
    teamsData.push({id:50+RID,name:'Boca Real',short:'BR',color:'#003',text:'#fff'});
    teamsData.push({id:51+RID,name:'River Real',short:'RR',color:'#a00',text:'#fff'});
    standings.push({teamId:50+RID,divId:10+RID,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0});
    standings.push({teamId:51+RID,divId:10+RID,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0});

    // render tree expanded
    _dtExpLigas.add(5);
    _renderDtLeft();
    const treeTorneoImg = document.querySelector('#dt-left .dt-node-torneo img');
    const treeImgSrcOk = treeTorneoImg?.getAttribute('src')?.startsWith('data:image/');

    // center torneo view
    _dtShowTorneoCenter(3+RID);
    const centerHdrImg = document.querySelector('#vtd-content .league-icon img');
    const centerImgSrcOk = centerHdrImg?.getAttribute('src')?.startsWith('data:image/');

    // division center view
    _dtShowDivisionCenter(10+RID);
    const divHdrImg = document.querySelector('#vtd-content .league-icon img');
    const divImgSrcOk = divHdrImg?.getAttribute('src')?.startsWith('data:image/');

    return { treeTorneoImg: !!treeTorneoImg, treeImgSrcOk, centerHdrImg: !!centerHdrImg, centerImgSrcOk, divHdrImg: !!divHdrImg, divImgSrcOk };
  });

  console.log('=== TORNEO LOGO IN 3 PLACES ===');
  console.log(JSON.stringify(res, null, 2));
  console.log(res.treeTorneoImg && res.treeImgSrcOk ? '✅ Left tree: torneo logo shown' : '❌ tree logo');
  console.log(res.centerHdrImg && res.centerImgSrcOk ? '✅ Center torneo header: logo shown' : '❌ center logo');
  console.log(res.divHdrImg && res.divImgSrcOk ? '✅ Division center header: torneo logo shown' : '❌ div logo');

  // also confirm a torneo WITHOUT logo doesn't break (falls back)
  const noLogo = await page.evaluate(() => {
    const RID=10000000;
    torneos.push({id:9+RID,_rid:9,leagueId:5,name:'Sin Logo',status:'active',start:'2026',divsCount:0,logoUrl:null});
    _renderDtLeft();
    _dtShowTorneoCenter(9+RID);
    return { hasImg: !!document.querySelector('#vtd-content .league-icon img'), txt: document.querySelector('#vtd-content .league-icon')?.textContent?.trim() };
  });
  console.log('\n=== FALLBACK (no torneo logo) ===');
  console.log(JSON.stringify(noLogo));
  console.log(!noLogo.hasImg ? '✅ Falls back to liga icon/emoji when torneo has no logo' : (noLogo.hasImg?'✅ shows liga logo img fallback':'❌'));

  console.log('\n=== JS ERRORS ===');
  console.log(errors.length===0 ? '✅ No JS errors' : errors.map(e=>'❌ '+e).join('\n'));

  // screenshot
  await page.evaluate(()=>{ _dtShowTorneoCenter(3+10000000); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/home/user/Liga/tlogo_01.png' });
  await browser.close();
})().catch(e=>console.error('FATAL:', e.message));
