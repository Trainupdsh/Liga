-- =============================================
-- SACAR LA CONTRASEÑA DE SUPERADMIN DEL HTML PÚBLICO
-- =============================================
-- Hasta ahora el superadmin se validaba con una constante escrita en
-- prototipo.html:
--
--     const SUPERADMIN={email:'...',pass:'...'};
--
-- Como ese archivo se sirve tal cual a cualquier visitante, la contraseña
-- que da acceso total a TODAS las ligas estaba a la vista de cualquiera que
-- abriera "ver código fuente". Rotarla no alcanzaba: la nueva quedaba
-- igual de expuesta.
--
-- Esta migración mueve la credencial a la tabla superadmins, la blinda para
-- que el rol anon no pueda leerla (ni siquiera el hash), y agrega una
-- función RPC que valida el login del lado del servidor — el mismo patrón
-- que ya usan liga, delegado y árbitro en la migración 003.
--
-- La tabla superadmins ya existía en la base con esta forma:
--     id uuid, username varchar, password_hash varchar, created_at timestamptz
-- así que se respeta tal cual. El identificador de login es `username`, y
-- ahí es donde va el email con el que entrás.
--
-- Correla entera en el SQL Editor de Supabase. Es idempotente.
-- IMPORTANTE: al final hay UN PASO MANUAL para cargar tu contraseña.
-- Sin ese paso el superadmin no puede entrar.
-- =============================================


-- 1) La tabla ya existe; esto es solo para que una base nueva quede igual.
create table if not exists public.superadmins (
  id            uuid primary key default gen_random_uuid(),
  username      varchar not null,
  password_hash varchar not null,
  created_at    timestamptz default now()
);

-- Asegurar lo que el paso manual necesita, sin alterar lo que ya esté bien:
-- un default para el id (si la tabla vieja no lo tenía, el insert fallaría)
-- y un índice único en username (lo usa el "on conflict" del paso manual).
alter table public.superadmins alter column id set default gen_random_uuid();
create unique index if not exists superadmins_username_key
  on public.superadmins (username);

-- 2) Nadie que venga por la API pública puede tocar esta tabla. Doble
--    candado: se revocan los permisos (Supabase los otorga por defecto a
--    anon/authenticated en las tablas de public) y además se activa RLS sin
--    ninguna política, que niega todo por si algún grant se reintroduce más
--    adelante. La función RPC de abajo es security definer, así que sigue
--    pudiendo leerla aunque quien la llame sea anon.
revoke all on public.superadmins from anon, authenticated;
alter table public.superadmins enable row level security;

-- 3) Trigger de hasheo, igual que en la migración 003: si el valor que se
--    escribe no tiene ya forma de hash bcrypt, se hashea antes de guardar.
--    Gracias a esto el paso manual del final se escribe con la contraseña
--    en texto plano y queda guardada hasheada.
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

  execute format($tpl$
    create or replace function public.hash_superadmin_pass() returns trigger
    language plpgsql
    set search_path = public
    as $fn$
    begin
      if new.password_hash is not null and new.password_hash !~ '^\$2[aby]\$' then
        new.password_hash := %I.crypt(new.password_hash, %I.gen_salt('bf'));
      end if;
      return new;
    end;
    $fn$
  $tpl$, ext_schema, ext_schema);

  -- 4) Función de login. Devuelve el usuario si la contraseña coincide, o
  --    nada si no. Nunca devuelve el hash. El parámetro se llama p_email
  --    porque es lo que tipeás en la pantalla de login, pero se compara
  --    contra la columna username, que es como se llama en esta tabla.
  execute format($tpl$
    create or replace function public.verificar_login_superadmin(p_email text, p_pass text)
    returns jsonb
    language sql
    security definer
    set search_path = public
    as $fn$
      select jsonb_build_object('username', s.username)
      from public.superadmins s
      where s.username = p_email
        and s.password_hash = %I.crypt(p_pass, s.password_hash)
      limit 1
    $fn$
  $tpl$, ext_schema);
end
$migration$;

drop trigger if exists trg_hash_superadmin_pass on public.superadmins;
create trigger trg_hash_superadmin_pass
  before insert or update of password_hash on public.superadmins
  for each row execute function public.hash_superadmin_pass();

-- Cualquiera puede intentar loguearse (o sea, ejecutar la función), pero
-- solo devuelve algo si la contraseña es correcta.
grant execute on function public.verificar_login_superadmin(text, text) to anon, authenticated;


-- =============================================
-- PASO MANUAL — CARGAR TU CONTRASEÑA
-- =============================================
-- Copiá las líneas de abajo en una consulta NUEVA del SQL Editor,
-- reemplazá el usuario y la contraseña por los tuyos, y ejecutalas.
--
-- Va aparte a propósito: así tu contraseña real nunca queda escrita en este
-- archivo, que vive en el repositorio de GitHub. El trigger de arriba la
-- hashea al guardarla, así que la escribís en texto plano acá y en la base
-- queda solo el hash.
--
-- ELEGÍ UNA CONTRASEÑA NUEVA, no reutilices la que estaba en el HTML: esa
-- estuvo publicada y además quedó registrada en el historial de git, así
-- que hay que considerarla comprometida para siempre.
--
--     insert into public.superadmins (username, password_hash)
--     values ('tu-email@ejemplo.com', 'TU-CONTRASEÑA-NUEVA')
--     on conflict (username) do update set password_hash = excluded.password_hash;
--
-- Para comprobar que quedó bien (debe devolver una fila con tu usuario):
--
--     select public.verificar_login_superadmin('tu-email@ejemplo.com', 'TU-CONTRASEÑA-NUEVA');
--
-- Y para confirmar que la contraseña no quedó en texto plano:
--
--     select username, left(password_hash, 4) as empieza_con from public.superadmins;
--     -- tiene que mostrar $2a$ (o $2b$), no tu contraseña.
