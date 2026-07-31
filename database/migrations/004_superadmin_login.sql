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
-- Esta migración mueve la credencial a una tabla que el rol anon no puede
-- leer (ni siquiera el hash), y agrega una función RPC que valida el login
-- del lado del servidor — el mismo patrón que ya usan liga, delegado y
-- árbitro en la migración 003.
--
-- Correla entera en el SQL Editor de Supabase. Es idempotente.
-- IMPORTANTE: al final hay UN PASO MANUAL para cargar tu contraseña.
-- Sin ese paso el superadmin no puede entrar.
-- =============================================


-- 1) Tabla de superadmins. La contraseña se guarda hasheada con bcrypt.
create table if not exists public.superadmins (
  id            serial primary key,
  email         text not null unique,
  password_hash text not null,
  nombre        text,
  created_at    timestamptz default now()
);

-- 2) Nadie que venga por la API pública puede tocar esta tabla. Doble
--    candado: se revocan los permisos (Supabase los otorga por defecto a
--    anon/authenticated en las tablas nuevas de public) y además se activa
--    RLS sin ninguna política, que niega todo por si algún grant se
--    reintroduce más adelante. La función RPC de abajo es security definer,
--    así que sigue pudiendo leerla aunque quien la llame sea anon.
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

  -- 4) Función de login. Devuelve email y nombre si la contraseña coincide,
  --    o nada si no. Nunca devuelve el hash.
  execute format($tpl$
    create or replace function public.verificar_login_superadmin(p_email text, p_pass text)
    returns jsonb
    language sql
    security definer
    set search_path = public
    as $fn$
      select jsonb_build_object('email', s.email, 'nombre', s.nombre)
      from public.superadmins s
      where s.email = p_email
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
-- Copiá las dos líneas de abajo en una consulta NUEVA del SQL Editor,
-- reemplazá el email y la contraseña por los tuyos, y ejecutalas.
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
--     insert into public.superadmins (email, password_hash, nombre)
--     values ('tu-email@ejemplo.com', 'TU-CONTRASEÑA-NUEVA', 'Lucas')
--     on conflict (email) do update set password_hash = excluded.password_hash;
--
-- Para comprobar que quedó bien (debe devolver una fila con tu email):
--
--     select public.verificar_login_superadmin('tu-email@ejemplo.com', 'TU-CONTRASEÑA-NUEVA');
--
-- Y para confirmar que la contraseña no quedó en texto plano:
--
--     select email, left(password_hash, 4) as empieza_con from public.superadmins;
--     -- tiene que mostrar $2a$ (o $2b$), no tu contraseña.
