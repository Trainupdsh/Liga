// Helper para ejecutar SQL en la base de Supabase usando la Management API
// (https://api.supabase.com). Requiere un Personal Access Token de Supabase en
// la variable de entorno SUPABASE_ACCESS_TOKEN (se genera en
// https://supabase.com/dashboard/account/tokens y se guarda como secret de
// GitHub Actions). No usa la clave publishable — esta API sí puede cambiar
// RLS, políticas y el esquema.
//
// Uso:  node scripts/db_exec.mjs "SELECT 1;"
//   o:  echo "SQL..." | node scripts/db_exec.mjs -
export const PROJECT_REF = 'qksdonfcqikcvmjztpwf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

export async function runSql(query) {
  if (!TOKEN) throw new Error('Falta SUPABASE_ACCESS_TOKEN');
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// Ejecutable directo
if (import.meta.url === `file://${process.argv[1]}`) {
  let sql = process.argv[2];
  if (sql === '-') sql = await new Promise(r => { let d = ''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => r(d)); });
  if (!sql) { console.error('Pasá el SQL como argumento o por stdin con "-"'); process.exit(1); }
  runSql(sql).then(rows => console.log(JSON.stringify(rows, null, 2)))
    .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}
