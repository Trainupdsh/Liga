// Releva el estado actual de la base: tablas, si tienen RLS activado y qué
// políticas existen. Sirve para diseñar el blindaje sin romper nada.
import { runSql } from './db_exec.mjs';

const SQL = `
select
  t.tablename,
  t.rowsecurity as rls_activado,
  coalesce(p.n, 0) as politicas
from pg_tables t
left join (
  select tablename, count(*) n from pg_policies where schemaname='public' group by tablename
) p on p.tablename = t.tablename
where t.schemaname='public'
order by t.tablename;
`;

const COLS = `
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and (column_name ilike '%pass%' or column_name ilike '%password%')
order by table_name, column_name;
`;

const res = await runSql(SQL);
console.log('── Tablas / RLS / políticas ──');
console.table(res);

const cols = await runSql(COLS);
console.log('\n── Columnas sensibles (contraseñas) ──');
console.table(cols);
