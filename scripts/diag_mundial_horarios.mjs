// Diagnóstico puntual: compara el fecha/hora guardado en Sporvix para partidos
// de fase de grupos contra el utcDate real de football-data.org, para entender
// si cargar_mundial.mjs guardó hora real (sin convertir a ART) o una fecha
// sintética generada por el propio fixture de Sporvix.
const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const SUPA_URL = 'https://qksdonfcqikcvmjztpwf.supabase.co';
const SUPA_KEY = 'sb_publishable_JZ3V17H60UYA33u0mdD4kw_vKtt-F-o';

async function fetchFootballData(path) {
  const res = await fetch(`https://api.football-data.org/v4${path}`, { headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}
async function supaGet(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function main() {
  const ligas = await supaGet(`/ligas?nombre=eq.${encodeURIComponent('Copa Mundial 2026')}&select=id`);
  const ligaId = ligas[0].id;
  const torneos = await supaGet(`/torneos?liga_id=eq.${ligaId}&select=id`);
  const torneoId = torneos[0].id;
  const divisiones = await supaGet(`/divisiones?torneo_id=eq.${torneoId}&select=id,nombre`);
  console.log('Divisiones:', divisiones.map(d => `${d.id}:${d.nombre}`).join(', '));

  const allDivIds = divisiones.map(d => d.id);
  const partidos = await supaGet(`/partidos?division_id=in.(${allDivIds.join(',')})&select=id,division_id,fase,fecha,hora,estado,equipo_local:equipo_local_id(nombre),equipo_visita:equipo_visita_id(nombre)&order=fecha`);
  console.log(`Total partidos: ${partidos.length}`);
  const porFase = {};
  partidos.forEach(p => { const k = p.fase || 'null'; porFase[k] = (porFase[k] || 0) + 1; });
  console.log('Distribución por fase:', JSON.stringify(porFase));

  const { matches } = await fetchFootballData(`/competitions/WC/matches`);
  const byPair = new Map();
  for (const m of matches) {
    if (!m.homeTeam?.name || !m.awayTeam?.name) continue;
    byPair.set(`${m.homeTeam.name}___${m.awayTeam.name}`, m);
    byPair.set(`${m.awayTeam.name}___${m.homeTeam.name}`, m);
  }

  console.log('\n── Muestra de 10 partidos de fase de grupos (fase null/regular) ──');
  const grupo = partidos.filter(p => !p.fase || p.fase === 'regular').slice(0, 10);
  for (const p of grupo) {
    const ln = p.equipo_local?.nombre, vn = p.equipo_visita?.nombre;
    const real = byPair.get(`${ln}___${vn}`);
    console.log(`  Sporvix: ${ln} vs ${vn} → ${p.fecha} ${p.hora} (fase=${p.fase}) | Real API utcDate: ${real ? real.utcDate : 'NO ENCONTRADO'}`);
  }

  console.log('\n── Muestra de 10 partidos de fase eliminatoria ──');
  const elim = partidos.filter(p => p.fase && p.fase !== 'regular').slice(0, 10);
  for (const p of elim) {
    const ln = p.equipo_local?.nombre, vn = p.equipo_visita?.nombre;
    const real = byPair.get(`${ln}___${vn}`);
    console.log(`  Sporvix: ${ln} vs ${vn} → ${p.fecha} ${p.hora} (fase=${p.fase}) | Real API utcDate: ${real ? real.utcDate : 'NO ENCONTRADO'}`);
  }
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
