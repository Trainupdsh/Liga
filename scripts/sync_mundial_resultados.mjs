// Sincroniza la Copa Mundial 2026 real (football-data.org) con la liga
// "Copa Mundial 2026" cargada en Sporvix:
//   1) Actualiza el marcador/estado de los partidos ya cargados (fase de grupos
//      y eliminatoria) mientras se juegan, y corrige la fecha/hora al horario
//      real del partido (convertido a hora Argentina) tanto en grupos como en
//      eliminatoria — el fixture de grupos se genera con una fecha/hora
//      provisoria al cargar el Mundial, y este script la reemplaza por la real
//      apenas football-data.org confirma el partido.
//   2) Crea automáticamente los partidos de la fase eliminatoria (16avos, octavos,
//      cuartos, semis, 3er puesto, final) a medida que football-data.org confirma
//      los cruces — no hace falta cargarlos a mano.
//   3) Los equipos de la fase eliminatoria se registran en la división "Fase
//      Final" con su propio ID de equipo (mismo club, mismo escudo) en vez de
//      reutilizar el ID de equipo del grupo — la vista de escritorio de Sporvix
//      asocia equipos a una división puntual, y necesita esto para mostrar
//      nombres, escudos y la lista de partidos correctamente. Si alguna vez se
//      corrió una versión anterior de este script que sí reutilizaba el ID del
//      grupo, este script migra esos partidos solo la primera vez que corre.
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

// football-data.org da la fecha/hora en UTC. Argentina es UTC-3 todo el año
// (sin horario de verano), así que restar 3 horas y leer el resultado como si
// fuera UTC da directamente la fecha/hora "de pared" en Argentina.
function toArgentinaFechaHora(utcDateStr) {
  if (!utcDateStr) return { fecha: null, hora: null };
  const arg = new Date(new Date(utcDateStr).getTime() - 3 * 60 * 60 * 1000);
  const iso = arg.toISOString();
  return { fecha: iso.split('T')[0], hora: iso.split('T')[1].slice(0, 5) };
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
  const torneosRes = await supaGet(`/torneos?liga_id=eq.${ligaId}&select=id`);
  if (!torneosRes.length) { console.log('La liga existe pero no tiene torneo todavía.'); return; }
  const torneoId = torneosRes[0].id;

  const divisiones = await supaGet(`/divisiones?torneo_id=eq.${torneoId}&select=id,nombre`);
  const gruposDivIds = divisiones.filter(d => d.nombre !== FASE_FINAL_DIVISION_NOMBRE).map(d => d.id);
  let faseFinalDiv = divisiones.find(d => d.nombre === FASE_FINAL_DIVISION_NOMBRE) || null;

  // Equipos de los 12 grupos: fuente de verdad de nombre/club/escudo/colores
  // para poder replicar un equipo "propio" en la división Fase Final.
  const equiposGrupos = gruposDivIds.length
    ? await supaGet(`/equipos?division_id=in.(${gruposDivIds.join(',')})&select=id,nombre,club_id,abreviacion,color_principal,color_texto`)
    : [];
  const grupoInfoPorNombre = new Map(equiposGrupos.map(e => [e.nombre, e]));

  // Equipos que ya existen en "Fase Final" (si la división ya fue creada antes).
  const equiposFaseFinal = faseFinalDiv
    ? await supaGet(`/equipos?division_id=eq.${faseFinalDiv.id}&select=id,nombre`)
    : [];
  const faseFinalIdPorNombre = new Map(equiposFaseFinal.map(e => [e.nombre, e.id]));
  const faseFinalIdSet = new Set(equiposFaseFinal.map(e => e.id));

  async function ensureFaseFinalDivision() {
    if (faseFinalDiv) return faseFinalDiv;
    console.log(`Creando división "${FASE_FINAL_DIVISION_NOMBRE}"...`);
    const [nueva] = await supaPost('/divisiones', { torneo_id: torneoId, nombre: FASE_FINAL_DIVISION_NOMBRE, categoria: null, genero: 'Masculino' });
    faseFinalDiv = nueva;
    return faseFinalDiv;
  }
  async function getOrCreateFaseFinalEquipoId(nombre) {
    if (faseFinalIdPorNombre.has(nombre)) return faseFinalIdPorNombre.get(nombre);
    const g = grupoInfoPorNombre.get(nombre);
    if (!g) return null;
    await ensureFaseFinalDivision();
    const [nuevo] = await supaPost('/equipos', {
      division_id: faseFinalDiv.id, club_id: g.club_id, nombre,
      abreviacion: g.abreviacion, color_principal: g.color_principal, color_texto: g.color_texto,
    });
    faseFinalIdPorNombre.set(nombre, nuevo.id);
    faseFinalIdSet.add(nuevo.id);
    return nuevo.id;
  }

  console.log('Leyendo partidos ya cargados en Sporvix (grupos + eliminatoria)...');
  const allDivIds = divisiones.map(d => d.id);
  const partidos = allDivIds.length
    ? await supaGet(`/partidos?division_id=in.(${allDivIds.join(',')})&select=id,division_id,estado,fase,fecha,hora,goles_local,goles_visita,equipo_local_id,equipo_visita_id,equipo_local:equipo_local_id(nombre),equipo_visita:equipo_visita_id(nombre)`)
    : [];

  // Migración: si una corrida anterior del script dejó partidos de "Fase Final"
  // apuntando al equipo del grupo original (en vez de al equipo propio de esta
  // división), los corrige. Sin esto, la vista de escritorio de Sporvix no
  // encuentra el equipo (queda con "0 equipos"/nombres en blanco) porque busca
  // los equipos de cada división por su propio division_id.
  let migrados = 0;
  if (faseFinalDiv) {
    for (const p of partidos) {
      if (p.division_id !== faseFinalDiv.id) continue;
      const ln = p.equipo_local?.nombre, vn = p.equipo_visita?.nombre;
      if (!ln || !vn) continue;
      const localOk = faseFinalIdSet.has(p.equipo_local_id);
      const visitaOk = faseFinalIdSet.has(p.equipo_visita_id);
      if (localOk && visitaOk) continue;
      const nuevoLocalId = localOk ? p.equipo_local_id : await getOrCreateFaseFinalEquipoId(ln);
      const nuevoVisitaId = visitaOk ? p.equipo_visita_id : await getOrCreateFaseFinalEquipoId(vn);
      if (!nuevoLocalId || !nuevoVisitaId) continue;
      await supaPatch(`/partidos?id=eq.${p.id}`, { equipo_local_id: nuevoLocalId, equipo_visita_id: nuevoVisitaId });
      p.equipo_local_id = nuevoLocalId; p.equipo_visita_id = nuevoVisitaId;
      migrados++;
      console.log(`  ↺ migrado a equipo propio de "Fase Final": ${ln} vs ${vn} (partido id=${p.id})`);
    }
    if (migrados) console.log(`${migrados} partido(s) migrado(s) a equipos propios de "Fase Final".`);
  }

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
      const updates = {};
      if (p.estado !== estado) updates.estado = estado;
      if (p.goles_local !== goles_local) updates.goles_local = goles_local;
      if (p.goles_visita !== goles_visita) updates.goles_visita = goles_visita;
      // Fecha/hora real del partido (grupos y eliminatoria), convertida a
      // hora Argentina. Postgres devuelve la columna "hora" como HH:MM:SS —
      // se recorta a HH:MM antes de comparar para no reescribir en cada
      // corrida un valor que ya está correcto.
      if (m.utcDate) {
        const { fecha, hora } = toArgentinaFechaHora(m.utcDate);
        const horaActual = (p.hora || '').slice(0, 5);
        if (fecha && (p.fecha !== fecha || horaActual !== hora)) { updates.fecha = fecha; updates.hora = hora; }
      }
      if (!Object.keys(updates).length) continue;
      await supaPatch(`/partidos?id=eq.${p.id}`, updates);
      actualizados++;
      console.log(`  ✓ actualizado: ${homeName} ${scoreHome ?? '-'} - ${scoreAway ?? '-'} ${awayName} (id=${p.id}, ${estado}${updates.hora ? ', hora ' + updates.fecha + ' ' + updates.hora + ' ART' : ''})`);
      continue;
    }

    // No existe todavía: si es un partido de eliminatoria confirmado por la API, lo creamos.
    const info = mapFase(m.stage || '');
    if (!info) continue; // fase de grupos que ya debería existir, o etapa no reconocida
    const localId = await getOrCreateFaseFinalEquipoId(homeName);
    const visitaId = await getOrCreateFaseFinalEquipoId(awayName);
    if (!localId || !visitaId) { sinEquipo++; console.log(`  ⚠ No se encontró en Sporvix a "${homeName}" o "${awayName}" (${m.stage}) — se omite por ahora.`); continue; }

    const { fecha, hora } = toArgentinaFechaHora(m.utcDate);
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

  console.log(`\nListo. ${actualizados} partido(s) actualizado(s), ${creados} partido(s) de eliminatoria creado(s), ${migrados} migrado(s)${sinEquipo ? `, ${sinEquipo} sin poder ubicar equipo` : ''}.`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
