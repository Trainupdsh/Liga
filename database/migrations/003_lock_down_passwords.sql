-- =============================================
-- CERRAR LA FUGA DE CONTRASEÑAS EN TEXTO PLANO
-- =============================================
-- Contexto: la app real (prototipo.html) habla directo con Supabase usando
-- la clave publishable (pública, embebida en el HTML). Hoy admin_pass
-- (ligas), delegado_pass (clubes) y password (arbitros) se guardan en texto
-- plano y se leen con select('*') desde el navegador para comparar contra lo
-- que tipea el usuario. Eso significa que CUALQUIERA con la clave pública
-- (o sea cualquiera que abra la página) puede leer esas columnas directo
-- por la REST API de Supabase, sin loguearse, y obtener todas las
-- contraseñas en texto plano.
--
-- Esta migración se aplica en DOS ETAPAS separadas a propósito:
--
--   ETAPA A (segura, no rompe nada): hashea las contraseñas existentes y
--   crea funciones RPC que validan login del lado del servidor sin exponer
--   la contraseña/hash al cliente. Se puede correr ya mismo.
--
--   ETAPA B (rompe el login actual si no se actualiza el front antes):
--   revoca el acceso directo (SELECT/UPDATE) a las columnas de contraseña
--   para anon/authenticated. Una vez aplicada, el código de prototipo.html
--   que hoy hace `.select('*')` o `.eq('...pass',...)` sobre estas columnas,
--   o `.update({admin_pass:...})` etc., empieza a fallar. NO correr la
--   Etapa B hasta que el front esté migrado a usar las funciones RPC de la
--   Etapa A (login) y a funciones RPC equivalentes para cambiar contraseña
--   (pendiente, no incluidas en este archivo).
--
-- Correlo en el SQL Editor de Supabase (Dashboard → SQL Editor). Es
-- idempotente: se puede volver a correr sin duplicar nada.
-- =============================================


-- ============ ETAPA A — segura, correr ahora ============

create extension if not exists pgcrypto;

-- 1) Hashear lo que hoy está en texto plano. El filtro `!~ '^\$2[aby]\$'`
--    evita re-hashear algo que ya tiene forma de hash bcrypt (para poder
--    correr esto más de una vez sin romper contraseñas ya migradas).
update public.ligas
   set admin_pass = crypt(admin_pass, gen_salt('bf'))
 where admin_pass is not null
   and admin_pass !~ '^\$2[aby]\$';

update public.clubes
   set delegado_pass = crypt(delegado_pass, gen_salt('bf'))
 where delegado_pass is not null
   and delegado_pass !~ '^\$2[aby]\$';

update public.arbitros
   set password = crypt(password, gen_salt('bf'))
 where password is not null
   and password !~ '^\$2[aby]\$';

-- 2) Funciones de verificación: reciben email + contraseña en texto plano
--    (viajan por HTTPS, eso está bien), comparan el hash del lado del
--    servidor y devuelven la fila SIN la columna de contraseña. Devuelven
--    jsonb para no depender de conocer el tipo exacto de cada columna.
--    security definer + search_path fijo: corren con los permisos del
--    dueño de la función (puede leer la columna de contraseña) aunque quien
--    las llama sea anon (que, después de la Etapa B, ya no puede).

create or replace function public.verificar_login_liga(p_email text, p_pass text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(l) - 'admin_pass'
  from public.ligas l
  where l.admin_email = p_email
    and l.admin_pass is not null
    and l.admin_pass = crypt(p_pass, l.admin_pass)
  limit 1
$$;

create or replace function public.verificar_login_delegado(p_email text, p_pass text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(c) - 'delegado_pass'
  from public.clubes c
  where c.delegado_email = p_email
    and c.delegado_pass is not null
    and c.delegado_pass = crypt(p_pass, c.delegado_pass)
  limit 1
$$;

create or replace function public.verificar_login_arbitro(p_email text, p_pass text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select (to_jsonb(a) - 'password') || jsonb_build_object('liga_nombre', l.nombre)
  from public.arbitros a
  left join public.ligas l on l.id = a.liga_id
  where a.email = p_email
    and a.password is not null
    and a.password = crypt(p_pass, a.password)
  limit 1
$$;

-- Cualquiera puede *ejecutar* la función (como cualquiera puede intentar
-- loguearse), pero la función sólo devuelve datos si el hash matchea, y
-- nunca devuelve la contraseña/hash.
grant execute on function public.verificar_login_liga(text, text) to anon, authenticated;
grant execute on function public.verificar_login_delegado(text, text) to anon, authenticated;
grant execute on function public.verificar_login_arbitro(text, text) to anon, authenticated;


-- ============ ETAPA B — NO correr todavía ============
-- Recién después de migrar prototipo.html para que:
--   • el login llame a verificar_login_liga / _delegado / _arbitro (RPC)
--     en vez de comparar en el cliente,
--   • ninguna pantalla haga select('*') (u otro select explícito de la
--     columna de contraseña) sobre ligas/clubes/arbitros,
--   • el cambio/blanqueo de contraseña use una función RPC nueva
--     (set_password_*, todavía por crear) en vez de
--     supabase.from(...).update({admin_pass:...}) directo.
--
-- descomentar y correr:
--
-- revoke select (admin_pass)    on public.ligas    from anon, authenticated;
-- revoke select (delegado_pass) on public.clubes   from anon, authenticated;
-- revoke select (password)      on public.arbitros from anon, authenticated;
--
-- revoke update (admin_pass)    on public.ligas    from anon, authenticated;
-- revoke update (delegado_pass) on public.clubes   from anon, authenticated;
-- revoke update (password)      on public.arbitros from anon, authenticated;
