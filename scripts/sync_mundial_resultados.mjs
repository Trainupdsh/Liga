// Sincroniza en vivo los resultados de la Copa Mundial 2026 real (football-data.org)
// con la liga "Copa Mundial 2026" cargada en Sporvix.
//
// Pensado para correr cada pocos minutos desde un workflow programado de GitHub
// Actions (.github/workflows/sync-mundial-vivo.yml) — no hace falta instalar nada,
// usa fetch nativo de Node.

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const SUPA_URL = 'https://qksdonfcqikcvmjztpwf.supabase.co';
const SUPA_KEY = 'sb_publishable_JZ3V17H60UYA33u0mdD4kw_vKtt-F-o';
const LIGA_NOMBRE = 'Copa Mundial 2026';

const ESTADO_POR_STATUS = {
  SCHEDULED: 'programado',
  TIMED: 'programado',
  IN_PLAY: 'en_curso',
  PAUSED: 'en_curso',
  FINISHED: 'finalizado',
};

function pairKey(a, b) { return `${a}___${b}`; }

async function fetchFootballData(path) {
  const res = await fetch(`https://api.football-data.org/v4${path}`, {
    headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN },
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function supaGet(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function supaPatch(path, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text().catch(() => '')}`);
}

async function main() {
  if (!FOOTBALL_DATA_TOKEN) throw new Error('Falta la variable de entorno FOOTBALL_DATA_TOKEN');

  // Ventana amplia (ayer/hoy/mañana en UTC) para no perder partidos por husos horarios.
  const today = new Date();
  const dateFrom = new Date(today); dateFrom.setUTCDate(dateFrom.getUTCDate() - 1);
  const dateTo = new Date(today); dateTo.setUTCDate(dateTo.getUTCDate() + 1);
  const fmt = d => d.toISOString().split('T')[0];

  console.log(`Consultando partidos del Mundial entre ${fmt(dateFrom)} y ${fmt(dateTo)}...`);
  const { matches } = await fetchFootballData(`/competitions/WC/matches?dateFrom=${fmt(dateFrom)}&dateTo=${fmt(dateTo)}`);
  const relevantes = (matches || []).filter(m => ESTADO_POR_STATUS[m.status]);
  console.log(`${relevantes.length} partido(s) en estado relevante (programado/en vivo/finalizado).`);
  if (!relevantes.length) { console.log('Nada para sincronizar por ahora.'); return; }

  console.log('Leyendo partidos de Sporvix (liga "Copa Mundial 2026")...');
  const partidos = await supaGet(
    `/partidos?estado=neq.finalizado&select=id,estado,goles_local,goles_visita,` +
    `equipo_local:equipo_local_id(nombre),equipo_visita:equipo_visita_id(nombre),` +
    `division:division_id(torneo:torneo_id(liga:liga_id(nombre)))`
  );
  const deLaLiga = partidos.filter(p => p.division?.torneo?.liga?.nombre === LIGA_NOMBRE);
  console.log(`${deLaLiga.length} partido(s) de "${LIGA_NOMBRE}" todavía sin cerrar en Sporvix.`);

  const index = new Map();
  for (const p of deLaLiga) {
    const ln = p.equipo_local?.nombre, vn = p.equipo_visita?.nombre;
    if (!ln || !vn) continue;
    index.set(pairKey(ln, vn), { p, swapped: false });
    index.set(pairKey(vn, ln), { p, swapped: true });
  }

  let actualizados = 0;
  for (const m of relevantes) {
    const homeName = m.homeTeam?.name, awayName = m.awayTeam?.name;
    if (!homeName || !awayName) continue;
    const hit = index.get(pairKey(homeName, awayName));
    if (!hit) continue; // no está (todavía) en la fase de grupos cargada, o ya está finalizado

    const estado = ESTADO_POR_STATUS[m.status];
    const scoreHome = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? (estado === 'en_curso' ? 0 : null);
    const scoreAway = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? (estado === 'en_curso' ? 0 : null);
    const goles_local = hit.swapped ? scoreAway : scoreHome;
    const goles_visita = hit.swapped ? scoreHome : scoreAway;

    const { p } = hit;
    const sinCambios = p.estado === estado && p.goles_local === goles_local && p.goles_visita === goles_visita;
    if (sinCambios) continue;

    await supaPatch(`/partidos?id=eq.${p.id}`, { estado, goles_local, goles_visita });
    actualizados++;
    console.log(`  ✓ ${homeName} ${scoreHome ?? '-'} - ${scoreAway ?? '-'} ${awayName} → partido id=${p.id} (${estado})`);
  }
  console.log(`\nListo. ${actualizados} partido(s) actualizado(s).`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
