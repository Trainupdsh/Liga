const { chromium } = require('playwright');

const MOCK = `(function(){
  const DB={ligas:[],torneos:[],divisiones:[],equipos:[],clubes:[],jugadores:[],partidos:[],arbitros:[],comunicados:[],planes:[]};
  const seq={}; function nid(t){seq[t]=(seq[t]||0)+1;return seq[t];}
  DB.ligas.push({id:1,nombre:'Liga Test',deporte:'Handball',activa:true,admin_email:'handball@baires.com',admin_pass:'handball2025',plan_id:null,logo_url:null,color:'#1a2150'});
  function match(rows,f){return rows.filter(r=>{
    for(const x of f.eqs){if(r[x.col]!==x.val)return false;}
    for(const x of f.ins){if(!x.vals.includes(r[x.col]))return false;}
    for(const x of f.nots){if(x.op==='is'&&x.val===null){if(r[x.col]===null||r[x.col]===undefined)return false;}}
    return true;});}
  class QB{
    constructor(t){this.t=t;this.f={eqs:[],ins:[],nots:[]};this.op='select';this._single=false;this._count=null;this._head=false;this._cols=undefined;this._payload=null;}
    select(c,o){this._cols=c;this._sel=true;if(o&&o.count){this._count=o.count;this._head=!!o.head;}return this;}
    insert(p){this.op='insert';this._payload=p;return this;}
    update(p){this.op='update';this._payload=p;return this;}
    delete(){this.op='delete';return this;}
    upsert(p){this.op='insert';this._payload=p;return this;}
    eq(c,v){this.f.eqs.push({col:c,val:v});return this;}
    in(c,v){this.f.ins.push({col:c,vals:v});return this;}
    not(c,op,v){this.f.nots.push({col:c,op,val:v===undefined?null:v});return this;}
    order(){return this;} limit(){return this;}
    single(){this._single=true;return this;} maybeSingle(){this._single=true;return this;}
    _exec(){const tbl=DB[this.t]||(DB[this.t]=[]);
      if(this.op==='insert'){const arr=Array.isArray(this._payload)?this._payload:[this._payload];
        const ins=arr.map(p=>{const row=Object.assign({id:nid(this.t)},p);tbl.push(row);return row;});
        const data=this._single?ins[0]:ins; return {data:this._sel?data:null,error:null};}
      let rows=match(tbl,this.f);
      if(this.op==='update'){rows.forEach(r=>Object.assign(r,this._payload));return {data:rows,error:null};}
      if(this.op==='delete'){const ids=new Set(rows.map(r=>r.id));DB[this.t]=tbl.filter(r=>!ids.has(r.id));return {data:rows,error:null};}
      if(this._count!==null)return {count:rows.length,data:this._head?null:rows,error:null};
      if(this._single)return rows.length?{data:rows[0],error:null}:{data:null,error:{message:'no rows'}};
      return {data:rows,error:null};}
    then(res,rej){try{res(this._exec());}catch(e){rej?rej(e):console.error(e);}}
  }
  const storage={from:()=>({upload:async()=>({error:null}),getPublicUrl:(p)=>({data:{publicUrl:'mock://'+p}})})};
  window.__DB=DB;
  window.supabase={createClient:()=>({from:t=>new QB(t),storage})};
})();`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', d => d.accept());          // auto-accept all confirm() prompts

  await page.route('**/supabase.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK }));

  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // login as the real (mock-backed) liga admin
  await page.evaluate(() => showView('view-login'));
  await page.fill('#login-email', 'handball@baires.com');
  await page.fill('#login-pass', 'handball2025');
  await page.evaluate(() => doAdminLogin());
  await page.waitForTimeout(500);
  console.log('liga admin id:', await page.evaluate(() => currentAdminLeagueId));

  // 1) Torneo
  const t = await page.evaluate(async () => {
    openNuevoTorneo();
    document.getElementById('nt-nombre').value = 'Apertura 2026';
    document.getElementById('nt-temporada').value = '2026';
    document.getElementById('nt-formato').value = 'roundrobin';
    await saveNuevoTorneo();
    return { torneoId: currentAdminTorneoId, count: window.__DB.torneos.length };
  });
  console.log('STEP torneo:', JSON.stringify(t));

  // 2) Division
  const d = await page.evaluate(async () => {
    openNuevaDivision();
    document.getElementById('nd-nombre').value = 'Primera División';
    document.getElementById('nd-categoria').value = 'Mayores';
    await saveNuevaDivision();
    return { divId: currentAdminDivisionId, count: window.__DB.divisiones.length };
  });
  console.log('STEP division:', JSON.stringify(d));

  // 3) 6 clubs (each with delegado credentials)
  const clubs = await page.evaluate(async () => {
    const names = ['Águilas','Leones','Toros','Halcones','Pumas','Cóndores'];
    for (let i = 0; i < 6; i++) {
      openNuevoClub();
      document.getElementById('nc-nombre').value = names[i];
      document.getElementById('nc-abrev').value = names[i].slice(0,3).toUpperCase();
      document.getElementById('nc-email').value = 'deleg' + (i+1) + '@club.com';
      document.getElementById('nc-pass').value = 'club' + (i+1) + '2026';
      document.getElementById('nc-dir').value = 'Cancha ' + (i+1);
      await saveNuevoClub();
    }
    await loadAdminClubes();
    return { clubs: window.__DB.clubes.length, withCreds: window.__DB.clubes.filter(c=>c.delegado_email).length };
  });
  console.log('STEP clubs:', JSON.stringify(clubs));

  // 4) inscribe the 6 clubs as equipos in the division
  const eq = await page.evaluate(async () => {
    for (const c of window.__DB.clubes) {
      await openNuevoEquipo();
      const sel = document.getElementById('ne-club');
      sel.value = String(c.id);
      document.getElementById('ne-nombre').value = '';
      await saveNuevoEquipo();
    }
    await loadAdminEquipos();
    return { equipos: window.__DB.equipos.length };
  });
  console.log('STEP equipos:', JSON.stringify(eq));

  // 5) 12 players per team = 72
  const players = await page.evaluate(async () => {
    const pos = ['Arquero','Defensor','Mediocampista','Delantero'];
    for (const team of window.__DB.equipos) {
      for (let n = 1; n <= 12; n++) {
        openNuevoJugador();
        document.getElementById('nj-nombre').value = team.nombre + ' Jugador ' + n;
        document.getElementById('nj-numero').value = String(n);
        document.getElementById('nj-posicion').value = pos[n % 4];
        document.getElementById('nj-equipo').value = String(team.id);
        await saveNuevoJugador();
      }
    }
    const counts = {};
    window.__DB.jugadores.forEach(j => counts[j.equipo_id] = (counts[j.equipo_id]||0)+1);
    return { total: window.__DB.jugadores.length, perTeam: counts };
  });
  console.log('STEP players:', JSON.stringify(players));

  // 6) referees
  const refs = await page.evaluate(async () => {
    const names = ['Árbitro Uno','Árbitro Dos','Árbitro Tres','Árbitro Cuatro'];
    for (let i = 0; i < names.length; i++) {
      openNuevoArbitro();
      document.getElementById('arb-nombre').value = names[i];
      document.getElementById('arb-email').value = 'ref' + (i+1) + '@liga.com';
      document.getElementById('arb-password').value = 'ref' + (i+1) + '2026';
      await saveArbitro();
    }
    return { arbitros: window.__DB.arbitros.length };
  });
  console.log('STEP referees:', JSON.stringify(refs));

  // 7) generate fixture
  const fx = await page.evaluate(async () => {
    await loadAdminEquipos();
    await generarFixture();
    const p = window.__DB.partidos;
    const dates = [...new Set(p.map(x => x.fecha))];
    const rounds = [...new Set(p.map(x => x.jornada))];
    return { partidos: p.length, dates: dates.length, rounds: rounds.length };
  });
  console.log('STEP fixture:', JSON.stringify(fx));

  // 8) assign a referee to EVERY match (round-robin over the 4 refs)
  const assign = await page.evaluate(async () => {
    await loadAdminPartidos();              // populates ligaArbitros
    const refsIds = window.__DB.arbitros.map(a => a.id);
    const p = window.__DB.partidos;
    for (let i = 0; i < p.length; i++) {
      await asignarArbitroPartido(p[i].id, String(refsIds[i % refsIds.length]));
    }
    const assigned = window.__DB.partidos.filter(x => x.arbitro_id).length;
    return { totalMatches: window.__DB.partidos.length, assigned };
  });
  console.log('STEP assign refs:', JSON.stringify(assign));

  // 9) SUPERADMIN usuarios panel: load + verify ALL user types, then edit a referee password
  await page.evaluate(() => logoutAdmin());
  await page.waitForTimeout(300);
  await page.evaluate(() => showView('view-login'));
  await page.fill('#login-email', 'lucasmoreno');
  await page.fill('#login-pass', '260110');
  await page.evaluate(() => doAdminLogin());
  await page.waitForTimeout(400);

  const usuarios = await page.evaluate(async () => {
    await loadSAUsuarios();
    const byRole = {};
    saAllRows.forEach(r => byRole[r.role] = (byRole[r.role]||0)+1);
    const arbRow = saAllRows.find(r => r.tipo === 'arbitro');
    const clubRow = saAllRows.find(r => r.tipo === 'club');
    return { total: saAllRows.length, byRole, sampleArb: arbRow, sampleClub: clubRow ? {name:clubRow.name,pass:clubRow.pass} : null };
  });
  console.log('STEP usuarios:', JSON.stringify(usuarios));
  await page.evaluate(() => {
    const p = document.getElementById('saUsuariosPanel'); if (p) p.style.display = '';
    if (typeof renderSARows === 'function') renderSARows(saAllRows, '');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-superadmin')?.classList.add('active');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'sim_usuarios_panel.png', fullPage: true });

  // edit referee credential via the central panel (exercises new applyAccessChange branch)
  const editRef = await page.evaluate(async () => {
    const arb = saAllRows.find(r => r.tipo === 'arbitro');
    await applyAccessChange(arb, 'ref1-NEW@liga.com', 'NUEVAclave99');
    const dbRow = window.__DB.arbitros.find(a => a.id === arb.arbitroId);
    return { before: { email: arb.email, pass: arb.pass }, afterDB: { email: dbRow.email, pass: dbRow.password } };
  });
  console.log('STEP edit referee cred:', JSON.stringify(editRef));

  // login with the NEW referee credentials (full round-trip)
  await page.evaluate(() => logoutAdmin());
  await page.waitForTimeout(300);
  await page.evaluate(() => showView('view-login'));
  await page.fill('#login-email', 'ref1-NEW@liga.com');
  await page.fill('#login-pass', 'NUEVAclave99');
  await page.evaluate(() => doAdminLogin());
  await page.waitForTimeout(400);
  const refLogin = await page.evaluate(() => ({
    onArbitroView: !!document.querySelector('#view-arbitro.active') || !!document.getElementById('view-arbitro')?.classList.contains('active'),
    sessionRole: (function(){try{return JSON.parse(sessionStorage.getItem('liga_session')||'{}').role;}catch(e){return null;}})()
  }));
  console.log('STEP referee re-login:', JSON.stringify(refLogin));

  console.log('CONSOLE ERRORS (' + errors.length + '):');
  errors.slice(0, 25).forEach(e => console.log('  - ' + e));
  await browser.close();
})();
