const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1400,height:900} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const RID=10000000;
    leagues.push({id:5,name:'Mi Liga Real',sport:'Fútbol',color:'#1a3d20',icon:'⚽',_real:true});
    torneos.push({id:3+RID,_rid:3,leagueId:5,name:'Apertura 2026',status:'active',start:'2026',divsCount:0,logoUrl:null});
    divisiones.push({id:10+RID,_rid:10,torneoId:3+RID,name:'Primera',grupo:'Mayores',teams:1,rounds:10,currentRound:0,icon:'📋'});
    teamsData.push({id:50+RID,name:'Boca Real',short:'BR',color:'#003',text:'#fff',logoUrl:null});
    standings.push({teamId:50+RID,divId:10+RID,pj:4,pg:3,pe:0,pp:1,gf:8,gc:3,pts:9});
    // real player with explicit position + suspended
    players.push({id:90+RID,name:'Juan Pérez',jersey:10,team:50+RID,goals:5,yellows:1,reds:0,fotoUrl:null,pos:'Delantero',suspended:true});

    _dtDblClickPlayer(90+RID);
    const txt = document.getElementById('vpd-content').textContent;
    return {
      view: document.querySelector('.view.active')?.id,
      showsRealPos: txt.includes('Delantero'),
      showsDivision: txt.includes('Mayores') || txt.includes('Primera'),
      showsSuspended: txt.includes('Suspendido') || txt.includes('SUSP'),
      showsTeamPj: txt.includes('Partidos'),
    };
  });
  console.log(JSON.stringify(r,null,2));
  console.log(r.showsRealPos ? '✅ real position (Delantero) shown' : '❌ position');
  console.log(r.showsDivision ? '✅ division shown for real player' : '❌ division');
  console.log(r.showsSuspended ? '✅ suspended flag from real data' : '❌ suspended');
  console.log(errors.length===0?'✅ No JS errors':errors.slice(0,5).map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
