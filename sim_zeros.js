const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // Reproduce exactly what _dtEnsureTorneos builds for a real liga with:
  //  - 1 torneo, 2 divisions (Mayores Masculino, Sub-18 Femenino)
  //  - div A: 4 clubes, NO matches  -> all zeros
  //  - div B: 3 clubes, 1 finished match -> mix of zeros and results
  const built = await page.evaluate(() => {
    const RID=10000000;
    leagues.push({id:5,name:'Mi Liga Real',sport:'Fútbol',color:'#1a3d20',icon:'⚽',_real:true});

    // torneo
    const t={id:3,liga_id:5,nombre:'Apertura 2026',estado:'activo',temporada:'2026'};
    torneos.push({id:t.id+RID,_rid:t.id,leagueId:t.liga_id,name:t.nombre,status:'active',start:'2026',divsCount:0});

    // divisions
    const ds=[
      {id:10,torneo_id:3,nombre:'Primera',categoria:'Mayores',genero:'Masculino',total_rondas:10,ronda_actual:0},
      {id:11,torneo_id:3,nombre:'Sub-18',categoria:'Juveniles',genero:'Femenino',total_rondas:8,ronda_actual:1},
    ];
    ds.forEach(d=>divisiones.push({id:d.id+RID,_rid:d.id,torneoId:d.torneo_id+RID,name:d.nombre,grupo:d.categoria||null,teams:0,rounds:d.total_rondas,currentRound:d.ronda_actual,icon:'📋'}));

    // equipos
    const eqs=[
      {id:50,division_id:10,nombre:'Boca Real',abreviacion:'BR',color_principal:'#003',color_texto:'#fff'},
      {id:51,division_id:10,nombre:'River Real',abreviacion:'RR',color_principal:'#a00',color_texto:'#fff'},
      {id:52,division_id:10,nombre:'San Lorenzo',abreviacion:'SL',color_principal:'#036',color_texto:'#fff'},
      {id:53,division_id:10,nombre:'Huracán',abreviacion:'HU',color_principal:'#c00',color_texto:'#fff'},
      {id:60,division_id:11,nombre:'Las Pumas',abreviacion:'LP',color_principal:'#063',color_texto:'#fff'},
      {id:61,division_id:11,nombre:'Estrellas',abreviacion:'ES',color_principal:'#306',color_texto:'#fff'},
      {id:62,division_id:11,nombre:'Cometas',abreviacion:'CO',color_principal:'#630',color_texto:'#fff'},
    ];
    eqs.forEach(e=>teamsData.push({id:e.id+RID,name:e.nombre,short:e.abreviacion,color:e.color_principal,text:e.color_texto}));

    const ps=[{division_id:11,equipo_local_id:60,equipo_visita_id:61,goles_local:3,goles_visita:1}]; // one finished match in div B

    const acc={};
    eqs.forEach(e=>{const k=e.division_id+RID;acc[k]=acc[k]||{};acc[k][e.id+RID]={teamId:e.id+RID,divId:k,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0};});
    ps.forEach(p=>{const d=acc[p.division_id+RID];if(!d)return;const h=d[p.equipo_local_id+RID],a=d[p.equipo_visita_id+RID];if(!h||!a)return;const gl=p.goles_local,gv=p.goles_visita;h.pj++;a.pj++;h.gf+=gl;h.gc+=gv;a.gf+=gv;a.gc+=gl;if(gl>gv){h.pg++;a.pp++;}else if(gl<gv){a.pg++;h.pp++;}else{h.pe++;a.pe++;}});
    Object.entries(acc).forEach(([k,rows])=>{const dId=parseInt(k);Object.values(rows).forEach(r=>{r.pts=r.pg*3+r.pe;standings.push(r);});const dv=divisiones.find(x=>x.id===dId);if(dv)dv.teams=Object.keys(rows).length;});

    // Now render the torneo center (what the user sees on liga click)
    _dtExpLigas.add(5);
    _dtShowTorneoCenter(3+RID);

    // Inspect rendered DOM
    const cards = Array.from(document.querySelectorAll('#vtd-content .vtd-div-hdr')).map(h=>h.textContent.replace(/\s+/g,' ').trim());
    const rows = Array.from(document.querySelectorAll('#vtd-content .vtd-st-row')).map(r=>{
      const c=r.querySelectorAll('.vtd-pos,.vtd-nm,.vtd-st,.vtd-dif,.vtd-pts');
      return Array.from(c).map(x=>x.textContent.trim()).join('|');
    });
    return { cards, rows, divCount: cards.length };
  });

  console.log('=== DIVISIONS / CATEGORIES SHOWN ===');
  built.cards.forEach(c=>console.log('  •', c));
  console.log('\n=== STANDINGS ROWS (pos|club|PJ|PG|PE|PP|Dif|Pts) ===');
  built.rows.forEach(r=>console.log('  ', r));

  const divAClubs = built.rows.filter(r=>/Boca Real|River Real|San Lorenzo|Huracán/.test(r));
  const allZeroDivA = divAClubs.every(r=>/\|0\|0\|0\|0\|/.test(r) || r.split('|').slice(2,6).every(v=>v==='0'));
  const pumasRow = built.rows.find(r=>r.includes('Las Pumas'));

  console.log('\n=== CHECKS ===');
  console.log(built.divCount===2 ? '✅ 2 divisiones/categorías visibles' : '❌ divisiones: '+built.divCount);
  console.log(divAClubs.length===4 ? '✅ División A: 4 clubes en la tabla' : '❌ div A clubs: '+divAClubs.length);
  console.log(allZeroDivA ? '✅ División A: todos los clubes en CERO' : '❌ div A no todos en cero');
  console.log(pumasRow && /Las Pumas\|1\|1\|0\|0\|\+2\|3/.test(pumasRow.replace('|','|')) ? '✅ División B: resultado real computado (Las Pumas 1PJ 3pts +2)' : '⚠️ div B Pumas row: '+pumasRow);

  console.log('\n=== JS ERRORS ===');
  console.log(errors.length===0 ? '✅ No JS errors' : errors.map(e=>'❌ '+e).join('\n'));

  await page.screenshot({ path: '/home/user/Liga/zeros_01_torneo.png' });
  await browser.close();
})().catch(e=>console.error('FATAL:', e.message));
