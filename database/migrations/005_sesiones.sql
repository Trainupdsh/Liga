-- =============================================
-- FASE 1 — SESIONES REALES (plomería, todavía no bloquea nada)
-- =============================================
-- Problema que ataca: hoy, después de loguearse, la app sigue hablando con
-- la base usando la misma clave pública que tiene cualquier visitante. Del
-- lado del servidor no hay forma de distinguir un pedido hecho por un admin
-- logueado de uno hecho por cualquiera desde la consola del navegador. Por
-- eso cualquiera puede escribir en equipos, partidos, jugadores, etc. sin
-- haberse logueado nunca.
--
-- La solución es que cada login genere una credencial de sesión guardada en
-- el servidor, que el navegador manda en cada pedido, y que las reglas de
-- acceso (RLS) consulten para decidir qué puede tocar cada uno.
--
-- ESTA MIGRACIÓN NO BLOQUEA NADA. Solo instala la plomería:
--   * la tabla de sesiones,
--   * que los login existentes emitan un token,
--   * las funciones que leen ese token en cada pedido,
--   * y una función de diagnóstico para comprobar que todo llega bien.
--
-- El bloqueo real (las políticas RLS) viene en una migración posterior,
-- recién después de verificar que esto funciona. Se hace en dos pasos a
-- propósito: si el token no llegara al servidor y ya hubiéramos activado
-- los bloqueos, la app quedaría inutilizable.
--
-- Es compatible con el sitio que está publicado ahora mismo: los login
-- devuelven lo mismo que antes más una clave nueva, que el front viejo
-- simplemente ignora. Correla sin miedo.
--
-- Correla entera en el SQL Editor de Supabase. Es idempotente.
-- =============================================


-- 1) Tabla de sesiones. Una fila por login activo.
create table if not exists public.sesiones (
  token       uuid primary key default gen_random_uuid(),
  rol         text not null check (rol in ('superadmin','liga','delegado','arbitro')),
  liga_id     bigint,
  club_id     bigint,
  arbitro_id  bigint,
  usuario     text,
  creada_en   timestamptz not null default now(),
  expira_en   timestamptz not null default now() + interval '12 hours'
);

create index if not exists sesiones_expira_idx on public.sesiones (expira_en);

-- 2) Nadie de afuera toca esta tabla. Solo la manipulan las funciones
--    security definer de más abajo. Doble candado igual que en la 004.
revoke all on public.sesiones from anon, authenticated;
alter table public.sesiones enable row level security;


do $migration$
declare
  ext_schema text;
begin
  select n.nspname into ext_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if ext_schema is null then
    raise exception 'pgcrypto no está instalada; corré antes la migración 003';
  end if;

  -- 3) Los login existentes ahora, además de verificar la contraseña, abren
  --    una sesión y devuelven su token en la clave "sesion_token". Todo lo
  --    demás que devolvían se mantiene igual, así que el sitio publicado
  --    hoy sigue funcionando sin cambios.

  execute format($tpl$
    create or replace function public.verificar_login_liga(p_email text, p_pass text)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    declare
      fila   public.ligas%%ROWTYPE;
      nuevo  uuid;
    begin
      select * into fila
      from public.ligas l
      where l.admin_email = p_email
        and l.admin_pass is not null
        and l.admin_pass = %I.crypt(p_pass, l.admin_pass)
      limit 1;

      if not found then return null; end if;

      insert into public.sesiones (rol, liga_id, usuario)
      values ('liga', fila.id, p_email)
      returning token into nuevo;

      return (to_jsonb(fila) - 'admin_pass') || jsonb_build_object('sesion_token', nuevo);
    end;
    $fn$
  $tpl$, ext_schema);

  execute format($tpl$
    create or replace function public.verificar_login_delegado(p_email text, p_pass text)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    declare
      fila   public.clubes%%ROWTYPE;
      lg     record;
      nuevo  uuid;
    begin
      select * into fila
      from public.clubes c
      where c.delegado_email = p_email
        and c.delegado_pass is not null
        and c.delegado_pass = %I.crypt(p_pass, c.delegado_pass)
      limit 1;

      if not found then return null; end if;

      select nombre, deporte into lg from public.ligas where id = fila.liga_id;

      insert into public.sesiones (rol, club_id, liga_id, usuario)
      values ('delegado', fila.id, fila.liga_id, p_email)
      returning token into nuevo;

      return (to_jsonb(fila) - 'delegado_pass')
             || jsonb_build_object('liga', jsonb_build_object('nombre', lg.nombre, 'deporte', lg.deporte))
             || jsonb_build_object('sesion_token', nuevo);
    end;
    $fn$
  $tpl$, ext_schema);

  execute format($tpl$
    create or replace function public.verificar_login_arbitro(p_email text, p_pass text)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    declare
      fila   public.arbitros%%ROWTYPE;
      lnom   text;
      nuevo  uuid;
    begin
      select * into fila
      from public.arbitros a
      where a.email = p_email
        and a.password is not null
        and a.password = %I.crypt(p_pass, a.password)
      limit 1;

      if not found then return null; end if;

      select nombre into lnom from public.ligas where id = fila.liga_id;

      insert into public.sesiones (rol, arbitro_id, liga_id, usuario)
      values ('arbitro', fila.id, fila.liga_id, p_email)
      returning token into nuevo;

      return (to_jsonb(fila) - 'password')
             || jsonb_build_object('liga_nombre', lnom, 'sesion_token', nuevo);
    end;
    $fn$
  $tpl$, ext_schema);

  execute format($tpl$
    create or replace function public.verificar_login_superadmin(p_email text, p_pass text)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    declare
      usr    text;
      nuevo  uuid;
    begin
      select s.username into usr
      from public.superadmins s
      where s.username = p_email
        and s.password_hash = %I.crypt(p_pass, s.password_hash)
      limit 1;

      if usr is null then return null; end if;

      insert into public.sesiones (rol, usuario)
      values ('superadmin', usr)
      returning token into nuevo;

      return jsonb_build_object('username', usr, 'sesion_token', nuevo);
    end;
    $fn$
  $tpl$, ext_schema);
end
$migration$;


-- 4) Lectura de la sesión del pedido actual.
--    PostgREST (la API de Supabase) expone los headers del pedido en
--    current_setting('request.headers'). El navegador manda ahí el token en
--    el header x-sporvix-session. Estas funciones lo leen y resuelven quién
--    está pidiendo. Son las que van a usar las políticas RLS más adelante.

-- OJO: devuelve SETOF (cero o una fila), no una fila sola. Si devolviera un
-- registro suelto, cuando no hay sesión Postgres igual entrega una fila con
-- todos los campos en nulo, y cualquier chequeo del estilo "¿hay sesión?"
-- daría verdadero para un visitante anónimo. Con SETOF, sin sesión no hay
-- ninguna fila y las políticas RLS niegan como corresponde.
create or replace function public.sesion_actual()
returns setof public.sesiones
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.sesiones s
  where s.token = nullif(
          current_setting('request.headers', true)::json ->> 'x-sporvix-session',
          ''
        )::uuid
    and s.expira_en > now()
  limit 1
$$;

create or replace function public.sesion_rol()
returns text language sql stable security definer set search_path = public
as $$ select rol from public.sesion_actual() $$;

create or replace function public.sesion_liga_id()
returns bigint language sql stable security definer set search_path = public
as $$ select liga_id from public.sesion_actual() $$;

create or replace function public.sesion_club_id()
returns bigint language sql stable security definer set search_path = public
as $$ select club_id from public.sesion_actual() $$;

create or replace function public.sesion_arbitro_id()
returns bigint language sql stable security definer set search_path = public
as $$ select arbitro_id from public.sesion_actual() $$;

-- Atajo que van a usar casi todas las políticas: ¿el pedido viene de alguien
-- que puede administrar esta liga? (el admin de esa liga, o el superadmin)
create or replace function public.puede_administrar_liga(p_liga_id bigint)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.sesion_actual() s
    where s.rol = 'superadmin'
       or (s.rol = 'liga' and s.liga_id = p_liga_id)
  )
$$;


-- 5) Cerrar sesión: borra el token para que no se pueda reusar.
create or replace function public.cerrar_sesion(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sesiones where token = p_token
$$;


-- 6) Diagnóstico: dice qué sesión ve el servidor en ESTE pedido. Sirve para
--    comprobar, antes de activar ningún bloqueo, que el token viaja bien
--    desde el navegador. No expone nada sensible.
create or replace function public.mi_sesion()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
              'reconocida', true,
              'rol', s.rol, 'liga_id', s.liga_id, 'club_id', s.club_id,
              'arbitro_id', s.arbitro_id, 'usuario', s.usuario, 'expira_en', s.expira_en)
     from public.sesion_actual() s),
    jsonb_build_object(
      'reconocida', false,
      'header_recibido',
      coalesce(current_setting('request.headers', true)::json ->> 'x-sporvix-session', '(ninguno)'))
  )
$$;


-- 7) Permisos: cualquiera puede *ejecutar* estas funciones (el login tiene
--    que ser posible sin estar logueado), pero solo devuelven algo útil con
--    credenciales válidas.
grant execute on function public.verificar_login_liga(text, text)       to anon, authenticated;
grant execute on function public.verificar_login_delegado(text, text)   to anon, authenticated;
grant execute on function public.verificar_login_arbitro(text, text)    to anon, authenticated;
grant execute on function public.verificar_login_superadmin(text, text) to anon, authenticated;
grant execute on function public.cerrar_sesion(uuid)                    to anon, authenticated;
grant execute on function public.mi_sesion()                            to anon, authenticated;

-- Las funciones que leen la sesión las usan las políticas RLS, que corren
-- con los permisos de quien hace el pedido: necesitan poder ejecutarlas.
grant execute on function public.sesion_actual()                to anon, authenticated;
grant execute on function public.sesion_rol()                   to anon, authenticated;
grant execute on function public.sesion_liga_id()               to anon, authenticated;
grant execute on function public.sesion_club_id()               to anon, authenticated;
grant execute on function public.sesion_arbitro_id()            to anon, authenticated;
grant execute on function public.puede_administrar_liga(bigint) to anon, authenticated;


-- 8) Limpieza de sesiones vencidas, para que la tabla no crezca sin control.
--    Se puede ejecutar a mano cada tanto, o programarla si tenés pg_cron.
create or replace function public.limpiar_sesiones_vencidas()
returns integer
language sql
security definer
set search_path = public
as $$
  with borradas as (delete from public.sesiones where expira_en < now() returning 1)
  select count(*)::integer from borradas
$$;
