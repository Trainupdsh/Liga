// Sincroniza la Copa Mundial 2026 real (football-data.org) con la liga
// "Copa Mundial 2026" cargada en Sporvix:
//   1) Actualiza el marcador/estado de los partidos ya cargados (fase de grupos
//      y eliminatoria) mientras se juegan.
//   2) Crea automáticamente los partidos de la fase eliminatoria (16avos, octavos,
//      cuartos, semis, 3er puesto, final) a medida que football-data.org confirma
//      los cruces — no hace falta cargarlos a mano.
//
// Pensado para correr cada pocos minutos desde un workflow programado de GitHub
// Actions (.github/workflows/sync-mundial-vivo.yml) — usa fetch nativo de Node,
// no hace falta instalar nada.

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const SUPA_URL = 'https://qksdonfcqikcvmjztpwf.supabase.co';
const SUPA_KEY = 'sb_publishable_JZ3V17H60UYA33u0mdD4kw_vKtt-F-o';
const LIGA_NOMBRE = 'Copa Mundial 2026';
const FASE_FINAL_DIVISION_NOMBRE = 'Fase Final';

const ESTADO_POR_STATUS = {
  SCHEDULED: 'programado',
  TIMED: 'programado',
  IN_PLAY: 'en_curso',
  PAUSED: 'en_curso',
  FINISHED: 'finalizado',
};

// De más específico a más genérico: "QUARTER_FINALS"/"SEMI_FINALS" contienen la
// palabra "FINAL", por eso el catch-all de Final va al final de la lista.
const FASE_RULES = [
  [/THIRD/, 'tercer_puesto', 5],
  [/SEMI/, 'semis', 4],
  [/QUARTER/, 'cuartos', 3],
  [/32/, 'dieciseisavos', 1],
  [/16/, 'octavos', 2],
  [/FINAL/, 'final', 6],
];
function mapFase(stage) {
  for (const [re, fase, orden] of FASE_RULES) if (re.test(stage)) return { fase, orden };
  return null; // GROUP_STAGE u otra etapa que no es eliminatoria
}

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

async function supaPost(path, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

function scoreOf(m) {
  return {
    home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
    away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
  };
}

async function main() {
  if (!FOOTBALL_DATA_TOKEN) throw new Error('Falta la variable de entorno FOOTBALL_DATA_TOKEN');

  console.log('Consultando todos los partidos del Mundial en football-data.org...');
  const { matches } = await fetchFootballData(`/competitions/WC/matches`);
  const relevantes = (matches || []).filter(m => ESTADO_POR_STATUS[m.status]);
  console.log(`${relevantes.length} partido(s) en estado relevante (programado/en vivo/finalizado) de ${matches?.length || 0} totales.`);

  console.log(`Buscando la liga "${LIGA_NOMBRE}" en Sporvix...`);
  const ligas = await supaGet(`/ligas?nombre=eq.${encodeURIComponent(LIGA_NOMBRE)}&select=id`);
  if (!ligas.length) { console.log(`No existe todavía la liga "${LIGA_NOMBRE}" — corré primero cargar_mundial.mjs.`); return; }
  const ligaId = ligas[0].id;
  const torneos = await supaGet(`/torneos?liga_id=eq.${ligaId}&select=id`);
  if (!torneos.length) { console.log('La liga existe pero no tiene torneo todavía.'); return; }
  const torneoId = torneos[0].id;

  const divisiones = await supaGet(`/divisiones?torneo_id=eq.${torneoId}&select=id,nombre`);
  let faseFinalDiv = divisiones.find(d => d.nombre === FASE_FINAL_DIVISION_NOMBRE);
  const divisionIds = divisiones.map(d => d.id);

  // Todos los equipos de cualquier fase (grupos + fase final) del Mundial, para
  // poder ubicar por nombre a los clasificados sin tener que volver a crearlos.
  const equipos = divisionIds.length
    ? await supaGet(`/equipos?division_id=in.(${divisionIds.join(',')})&select=id,nombre`)
    : [];
  const equipoIdPorNombre = new Map(equipos.map(e => [e.nombre, e.id]));

  console.log('Leyendo partidos ya cargados en Sporvix (grupos + eliminatoria)...');
  const partidos = divisionIds.length
    ? await supaGet(`/partidos?division_id=in.(${divisionIds.join(',')})&select=id,estado,fase,goles_local,goles_visita,equipo_local:equipo_local_id(nombre),equipo_visita:equipo_visita_id(nombre)`)
    : [];

  const index = new Map();
  for (const p of partidos) {
    const ln = p.equipo_local?.nombre, vn = p.equipo_visita?.nombre;
    if (!ln || !vn) continue;
    index.set(pairKey(ln, vn), { p, swapped: false });
    index.set(pairKey(vn, ln), { p, swapped: true });
  }

  let actualizados = 0, creados = 0, sinEquipo = 0;
  for (const m of relevantes) {
    const homeName = m.homeTeam?.name, awayName = m.awayTeam?.name;
    if (!homeName || !awayName) continue;
    const estado = ESTADO_POR_STATUS[m.status];
    const { home: scoreHome, away: scoreAway } = scoreOf(m);

    const hit = index.get(pairKey(homeName, awayName));
    if (hit) {
      // Ya existe el partido (de grupos o de una eliminatoria ya creada) → solo actualizar.
      const golesLocalDef = estado === 'en_curso' ? (scoreHome ?? 0) : scoreHome;
      const golesVisitaDef = estado === 'en_curso' ? (scoreAway ?? 0) : scoreAway;
      const goles_local = hit.swapped ? golesVisitaDef : golesLocalDef;
      const goles_visita = hit.swapped ? golesLocalDef : golesVisitaDef;
      const { p } = hit;
      const sinCambios = p.estado === estado && p.goles_local === goles_local && p.goles_visita === goles_visita;
      if (sinCambios) continue;
      await supaPatch(`/partidos?id=eq.${p.id}`, { estado, goles_local, goles_visita });
      actualizados++;
      console.log(`  ✓ actualizado: ${homeName} ${scoreHome ?? '-'} - ${scoreAway ?? '-'} ${awayName} (id=${p.id}, ${estado})`);
      continue;
    }

    // No existe todavía: si es un partido de eliminatoria confirmado por la API, lo creamos.
    const info = mapFase(m.stage || '');
    if (!info) continue; // fase de grupos que ya debería existir, o etapa no reconocida
    const localId = equipoIdPorNombre.get(homeName);
    const visitaId = equipoIdPorNombre.get(awayName);
    if (!localId || !visitaId) { sinEquipo++; console.log(`  ⚠ No se encontró en Sporvix a "${homeName}" o "${awayName}" (${m.stage}) — se omite por ahora.`); continue; }

    if (!faseFinalDiv) {
      console.log(`Creando división "${FASE_FINAL_DIVISION_NOMBRE}"...`);
      const [nueva] = await supaPost('/divisiones', { torneo_id: torneoId, nombre: FASE_FINAL_DIVISION_NOMBRE, categoria: null, genero: 'Masculino' });
      faseFinalDiv = nueva;
    }

    const fechaHora = m.utcDate ? new Date(m.utcDate) : null;
    const fecha = fechaHora ? fechaHora.toISOString().split('T')[0] : null;
    const hora = fechaHora ? fechaHora.toISOString().split('T')[1].slice(0, 5) : null;
    const [nuevoPartido] = await supaPost('/partidos', {
      division_id: faseFinalDiv.id, equipo_local_id: localId, equipo_visita_id: visitaId,
      fase: info.fase, jornada: info.orden, fecha, hora, cancha: null, estado,
      goles_local: estado === 'en_curso' ? (scoreHome ?? 0) : scoreHome,
      goles_visita: estado === 'en_curso' ? (scoreAway ?? 0) : scoreAway,
    });
    index.set(pairKey(homeName, awayName), { p: nuevoPartido, swapped: false });
    index.set(pairKey(awayName, homeName), { p: nuevoPartido, swapped: true });
    creados++;
    console.log(`  ★ creado: ${homeName} vs ${awayName} — ${info.fase} (id=${nuevoPartido.id}, ${estado})`);
  }

  console.log(`\nListo. ${actualizados} partido(s) actualizado(s), ${creados} partido(s) de eliminatoria creado(s)${sinEquipo ? `, ${sinEquipo} sin poder ubicar equipo` : ''}.`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
