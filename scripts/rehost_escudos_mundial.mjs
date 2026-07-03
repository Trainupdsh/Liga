// Re-hostea en Supabase Storage los escudos de los clubes del Mundial que
// todavía apuntan a una URL externa (crests.football-data.org, wikipedia,
// etc.) — esos hosts no siempre mandan las cabeceras CORS que necesita el
// <canvas> de "Compartir imagen" para poder leer el escudo, así que quedaba
// en blanco (el resto de la imagen se genera igual, solo el escudo no).
//
// Es idempotente: los clubes que ya tienen su escudo en Supabase Storage se
// saltean, así que se puede correr de nuevo sin problema cada vez que se
// suma un club nuevo (ej. cuando entra en juego un país que no se había
// tocado todavía).
//
// Uso: node rehost_escudos_mundial.mjs

const SUPA_URL = 'https://qksdonfcqikcvmjztpwf.supabase.co';
const SUPA_KEY = 'sb_publishable_JZ3V17H60UYA33u0mdD4kw_vKtt-F-o';
const LIGA_NOMBRE = 'Copa Mundial 2026';
const BUCKET = 'escudos';

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
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text().catch(() => '')}`);
}
async function subirAStorage(path, bytes, contentType) {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Supabase Storage ${res.status}: ${await res.text().catch(() => '')}`);
  return `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  console.log(`Buscando la liga "${LIGA_NOMBRE}"...`);
  const ligas = await supaGet(`/ligas?nombre=eq.${encodeURIComponent(LIGA_NOMBRE)}&select=id`);
  if (!ligas.length) { console.log('No existe esa liga todavía.'); return; }
  const ligaId = ligas[0].id;

  const clubes = await supaGet(`/clubes?liga_id=eq.${ligaId}&select=id,nombre,logo_url`);
  const pendientes = clubes.filter(c => c.logo_url && !c.logo_url.startsWith(SUPA_URL));
  console.log(`${clubes.length} club(es) en total, ${pendientes.length} con escudo externo por re-hostear.`);

  let ok = 0, fallidos = 0;
  for (const club of pendientes) {
    try {
      const res = await fetch(club.logo_url);
      if (!res.ok) throw new Error(`No se pudo descargar (${res.status})`);
      const contentType = res.headers.get('content-type') || 'image/png';
      const ext = contentType.includes('svg') ? 'svg' : contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const bytes = Buffer.from(await res.arrayBuffer());
      const path = `mundial_${club.id}.${ext}`;
      const publicUrl = await subirAStorage(path, bytes, contentType);
      await supaPatch(`/clubes?id=eq.${club.id}`, { logo_url: publicUrl });
      ok++;
      console.log(`  ✓ ${club.nombre} → ${publicUrl}`);
    } catch (e) {
      fallidos++;
      console.log(`  ⚠ ${club.nombre}: ${e.message}`);
    }
  }
  console.log(`\nListo. ${ok} escudo(s) re-hosteado(s), ${fallidos} fallido(s).`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
