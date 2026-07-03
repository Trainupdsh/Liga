// Diagnóstico puntual: valida si se pueden combinar consultas de
// torneos+divisiones y equipos+jugadores en un solo request con embeds
// anidados de PostgREST (reduce round-trips en _dtEnsureTorneos, que hoy
// hace 4 consultas secuenciales y por eso tarda en mostrar ligas grandes
// como el Mundial).
const SUPA_URL = 'https://qksdonfcqikcvmjztpwf.supabase.co';
const SUPA_KEY = 'sb_publishable_JZ3V17H60UYA33u0mdD4kw_vKtt-F-o';

async function supaGet(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const ligas = await supaGet(`/ligas?nombre=eq.${encodeURIComponent('Copa Mundial 2026')}&select=id`);
  const ligaId = ligas.body[0].id;
  console.log('Liga Mundial id:', ligaId);

  console.log('\n── Test 1: torneos + divisiones embebidas ──');
  const r1 = await supaGet(`/torneos?liga_id=eq.${ligaId}&select=*,divisiones(*)`);
  console.log('status:', r1.status, 'ok:', r1.ok);
  if (r1.ok) {
    const t = r1.body[0];
    console.log('torneo:', t.id, t.nombre, '| divisiones embebidas:', Array.isArray(t.divisiones) ? t.divisiones.length : 'NO ES ARRAY');
    console.log('ejemplo division:', JSON.stringify(t.divisiones?.[0])?.slice(0, 200));
  } else {
    console.log('ERROR body:', JSON.stringify(r1.body));
  }

  const divIds = r1.ok ? (r1.body[0].divisiones || []).map(d => d.id) : [];
  console.log('\n── Test 2: equipos + club + jugadores embebidos ──');
  const r2 = await supaGet(`/equipos?division_id=in.(${divIds.join(',')})&select=id,nombre,division_id,club:club_id(logo_url),jugadores(id,nombre,numero)`);
  console.log('status:', r2.status, 'ok:', r2.ok);
  if (r2.ok) {
    console.log('equipos:', r2.body.length);
    console.log('ejemplo equipo:', JSON.stringify(r2.body[0])?.slice(0, 300));
    const conJugadores = r2.body.filter(e => Array.isArray(e.jugadores) && e.jugadores.length);
    console.log('equipos con jugadores embebidos (probablemente 0, el Mundial no carga planteles):', conJugadores.length);
  } else {
    console.log('ERROR body:', JSON.stringify(r2.body));
  }
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
