-- =============================================
-- CERRAR LA FUGA DE CONTRASEÑAS EN TEXTO PLANO
-- =============================================
-- Contexto: la app real (prototipo.html) habla directo con Supabase usando
-- la clave publishable (pública, embebida en el HTML). Hoy admin_pass
-- (ligas), delegado_pass (clubes) y password (arbitros) se guardan en texto
-- plano y se leen con select('*') desde el navegador para comparar contra lo
-- que tipea el usuario — incluso la carga inicial de la home pública trae
-- admin_pass de TODAS las ligas a cualquier visitante, sin login. Eso
-- significa que cualquiera con la clave pública (o sea cualquiera que abra
-- la página) puede leer esas columnas directo por la REST API de Supabase,
-- sin loguearse, y obtener todas las contraseñas en texto plano.
--
-- Esta migración se aplica en DOS ETAPAS:
--
--   ETAPA A: hashea las contraseñas existentes, agrega triggers que hashean
--   automáticamente cualquier contraseña nueva que se escriba (así el código
--   de alta/edición de liga/club/árbitro no necesita cambiar: sigue mandando
--   la contraseña en texto plano en el UPDATE/INSERT, el trigger la hashea
--   antes de guardarla), y crea funciones RPC que validan login del lado del
--   servidor sin exponer la contraseña/hash al cliente.
--
--   ETAPA B: revoca la LECTURA directa de las columnas de contraseña para
--   anon/authenticated. Requiere que el front ya no las pida — prototipo.html
--   fue migrado para eso en este mismo cambio. La escritura (UPDATE/INSERT)
--   NO se revoca a propósito: sigue funcionando igual que hoy, protegida por
--   el trigger de hash de la Etapa A.
--
-- Correlo entero en el SQL Editor de Supabase (Dashboard → SQL Editor).
-- Es idempotente: se puede volver a correr sin duplicar nada.
--
-- *** ATENCIÓN SI VOLVÉS A CORRER ESTA MIGRACIÓN ***
-- Las funciones verificar_login_* que se definen acá fueron REEMPLAZADAS
-- después por la migración 005, que además de validar la contraseña abre una
-- sesión y devuelve un token. Volver a correr este archivo las pisa con la
-- versión vieja, que no emite token. El síntoma es engañoso: el login parece
-- andar (entrás igual), pero después no se puede guardar nada, porque las
-- políticas de las migraciones 006-008 dejan de reconocer al usuario.
--
-- Si re-corrés este archivo, CORRÉ LA 005 INMEDIATAMENTE DESPUÉS.
-- =============================================


-- ============ ETAPA A ============

create extension if not exists pgcrypto;

-- Todo lo que usa crypt()/gen_salt() se arma dentro de este bloque, que
-- primero averigua en qué esquema quedó instalada pgcrypto: Supabase la pone
-- en "extensions", otras instalaciones en "public". Después escribe cada
-- llamada calificada con ese esquema (extensions.crypt(...)), así no depende
-- del search_path ni de adivinar dónde está.
do $migration$
declare
  ext_schema text;
begin
  select n.nspname into ext_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if ext_schema is null then
    raise exception 'pgcrypto no quedó instalada, no puedo continuar';
  end if;

  raise notice 'pgcrypto encontrada en el esquema: %', ext_schema;

  -- 1) Hashear lo que hoy está en texto plano. El filtro `!~ '^\$2[aby]\$'`
  --    evita re-hashear algo que ya tiene forma de hash bcrypt (para poder
  --    correr esto más de una vez sin romper contraseñas ya migradas).
  execute format($tpl$
    update public.ligas
       set admin_pass = %I.crypt(admin_pass, %I.gen_salt('bf'))
     where admin_pass is not null
       and admin_pass !~ '^\$2[aby]\$'
  $tpl$, ext_schema, ext_schema);

  execute format($tpl$
    update public.clubes
       set delegado_pass = %I.crypt(delegado_pass, %I.gen_salt('bf'))
     where delegado_pass is not null
       and delegado_pass !~ '^\$2[aby]\$'
  $tpl$, ext_schema, ext_schema);

  execute format($tpl$
    update public.arbitros
       set password = %I.crypt(password, %I.gen_salt('bf'))
     where password is not null
       and password !~ '^\$2[aby]\$'
  $tpl$, ext_schema, ext_schema);

  -- 2) Triggers: cualquier valor nuevo que llegue a estas columnas y no
  --    tenga ya forma de hash bcrypt se hashea automáticamente antes de
  --    guardarse. Esto es lo que permite dejar el código de alta/edición
  --    de la app sin tocar.
  execute format($tpl$
    create or replace function public.hash_admin_pass() returns trigger
    language plpgsql
    set search_path = public
    as $fn$
    begin
      if new.admin_pass is not null and new.admin_pass !~ '^\$2[aby]\$' then
        new.admin_pass := %I.crypt(new.admin_pass, %I.gen_salt('bf'));
      end if;
      return new;
    end;
    $fn$
  $tpl$, ext_schema, ext_schema);

  execute format($tpl$
    create or replace function public.hash_delegado_pass() returns trigger
    language plpgsql
    set search_path = public
    as $fn$
    begin
      if new.delegado_pass is not null and new.delegado_pass !~ '^\$2[aby]\$' then
        new.delegado_pass := %I.crypt(new.delegado_pass, %I.gen_salt('bf'));
      end if;
      return new;
    end;
    $fn$
  $tpl$, ext_schema, ext_schema);

  execute format($tpl$
    create or replace function public.hash_arbitro_password() returns trigger
    language plpgsql
    set search_path = public
    as $fn$
    begin
      if new.password is not null and new.password !~ '^\$2[aby]\$' then
        new.password := %I.crypt(new.password, %I.gen_salt('bf'));
      end if;
      return new;
    end;
    $fn$
  $tpl$, ext_schema, ext_schema);

  -- 3) Funciones de verificación de login: reciben email + contraseña en
  --    texto plano (viajan por HTTPS, eso está bien), comparan contra el
  --    hash del lado del servidor y devuelven la fila SIN la columna de
  --    contraseña. Devuelven jsonb para no depender del tipo exacto de cada
  --    columna. security definer + search_path fijo: corren con los permisos
  --    del dueño de la función (que sí puede leer la columna de contraseña)
  --    aunque quien las llama sea anon (que, tras la Etapa B, ya no puede).
  execute format($tpl$
    create or replace function public.verificar_login_liga(p_email text, p_pass text)
    returns jsonb
    language sql
    security definer
    set search_path = public
    as $fn$
      select to_jsonb(l) - 'admin_pass'
      from public.ligas l
      where l.admin_email = p_email
        and l.admin_pass is not null
        and l.admin_pass = %I.crypt(p_pass, l.admin_pass)
      limit 1
    $fn$
  $tpl$, ext_schema);

  execute format($tpl$
    create or replace function public.verificar_login_delegado(p_email text, p_pass text)
    returns jsonb
    language sql
    security definer
    set search_path = public
    as $fn$
      select (to_jsonb(c) - 'delegado_pass')
             || jsonb_build_object('liga', jsonb_build_object('nombre', l.nombre, 'deporte', l.deporte))
      from public.clubes c
      left join public.ligas l on l.id = c.liga_id
      where c.delegado_email = p_email
        and c.delegado_pass is not null
        and c.delegado_pass = %I.crypt(p_pass, c.delegado_pass)
      limit 1
    $fn$
  $tpl$, ext_schema);

  execute format($tpl$
    create or replace function public.verificar_login_arbitro(p_email text, p_pass text)
    returns jsonb
    language sql
    security definer
    set search_path = public
    as $fn$
      select (to_jsonb(a) - 'password') || jsonb_build_object('liga_nombre', l.nombre)
      from public.arbitros a
      left join public.ligas l on l.id = a.liga_id
      where a.email = p_email
        and a.password is not null
        and a.password = %I.crypt(p_pass, a.password)
      limit 1
    $fn$
  $tpl$, ext_schema);
end
$migration$;

-- Enganchar los triggers a las tablas.
drop trigger if exists trg_hash_admin_pass on public.ligas;
create trigger trg_hash_admin_pass
  before insert or update of admin_pass on public.ligas
  for each row execute function public.hash_admin_pass();

drop trigger if exists trg_hash_delegado_pass on public.clubes;
create trigger trg_hash_delegado_pass
  before insert or update of delegado_pass on public.clubes
  for each row execute function public.hash_delegado_pass();

drop trigger if exists trg_hash_arbitro_password on public.arbitros;
create trigger trg_hash_arbitro_password
  before insert or update of password on public.arbitros
  for each row execute function public.hash_arbitro_password();

-- Cualquiera puede *ejecutar* las funciones de login (como cualquiera puede
-- intentar loguearse), pero solo devuelven datos si la contraseña matchea, y
-- nunca devuelven la contraseña/hash.
grant execute on function public.verificar_login_liga(text, text) to anon, authenticated;
grant execute on function public.verificar_login_delegado(text, text) to anon, authenticated;
grant execute on function public.verificar_login_arbitro(text, text) to anon, authenticated;


-- ============ ETAPA B ============
-- El front en este mismo cambio ya dejó de hacer select('*') (o cualquier
-- select explícito de la columna de contraseña) sobre ligas/clubes/arbitros,
-- y el login ahora usa las funciones RPC de arriba. Si por algún motivo
-- todavía no desplegaste ese prototipo.html, comentá estas tres líneas y
-- corrélas después: si no, las pantallas que aún pidan esa columna fallan.
--
-- Solo se toca SELECT, no UPDATE/INSERT: la escritura sigue igual que hoy
-- (los triggers de arriba se encargan de hashear).
--
-- OJO con un detalle que hace fallar esto en silencio: un `revoke select
-- (columna)` NO surte efecto si el rol además tiene un GRANT SELECT sobre la
-- tabla entera — que es justo como Supabase configura anon/authenticated por
-- defecto. El permiso de tabla le gana al de columna y la contraseña sigue
-- siendo legible. Por eso hay que revocar el SELECT de la tabla y volver a
-- otorgarlo columna por columna, salteando la de contraseña.
do $lockdown$
declare
  t record;
  cols text;
begin
  for t in
    select * from (values
      ('ligas',    'admin_pass'),
      ('clubes',   'delegado_pass'),
      ('arbitros', 'password')
    ) as x(tabla, col_secreta)
  loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into cols
    from information_schema.columns
    where table_schema = 'public'
      and table_name = t.tabla
      and column_name <> t.col_secreta;

    execute format('revoke select on public.%I from anon, authenticated', t.tabla);
    execute format('grant select (%s) on public.%I to anon, authenticated', cols, t.tabla);

    raise notice 'public.% : SELECT limitado a todas las columnas menos %', t.tabla, t.col_secreta;
  end loop;
end
$lockdown$;

-- NOTA DE MANTENIMIENTO: como el SELECT quedó otorgado columna por columna,
-- si más adelante agregás una columna nueva a ligas/clubes/arbitros, anon no
-- va a poder leerla hasta que le des permiso (o vuelvas a correr este bloque,
-- que la toma automáticamente).
