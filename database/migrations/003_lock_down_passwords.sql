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
--   ETAPA A (segura, no rompe nada): hashea las contraseñas existentes,
--   agrega triggers que hashean automáticamente cualquier contraseña nueva
--   que se escriba (así el código de alta/edición de liga/club/árbitro no
--   necesita cambiar: sigue mandando la contraseña en texto plano en el
--   UPDATE/INSERT, el trigger la hashea antes de guardarla), y crea
--   funciones RPC que validan login del lado del servidor sin exponer la
--   contraseña/hash al cliente. Se puede correr ya mismo.
--
--   ETAPA B (requiere el front actualizado primero): revoca la LECTURA
--   directa de las columnas de contraseña para anon/authenticated. Una vez
--   aplicada, cualquier `.select('*')` (u otro select explícito de esa
--   columna) sobre ligas/clubes/arbitros empieza a fallar. El front
--   (prototipo.html) ya fue migrado en este mismo cambio para no depender
--   de leer esas columnas — ver el commit correspondiente. La escritura
--   (UPDATE/INSERT) NO se revoca a propósito: sigue funcionando igual que
--   hoy, protegida por el trigger de hash de la Etapa A.
--
-- Correlo en el SQL Editor de Supabase (Dashboard → SQL Editor), en orden.
-- Es idempotente: se puede volver a correr sin duplicar nada.
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

-- 2) Triggers: cualquier valor nuevo que llegue a estas columnas y no tenga
--    ya forma de hash bcrypt se hashea automáticamente antes de guardarse.
--    Esto es lo que permite dejar el código de alta/edición sin tocar.

create or replace function public.hash_admin_pass() returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.admin_pass is not null and new.admin_pass !~ '^\$2[aby]\$' then
    new.admin_pass := crypt(new.admin_pass, gen_salt('bf'));
  end if;
  return new;
end;
$$;

create or replace function public.hash_delegado_pass() returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.delegado_pass is not null and new.delegado_pass !~ '^\$2[aby]\$' then
    new.delegado_pass := crypt(new.delegado_pass, gen_salt('bf'));
  end if;
  return new;
end;
$$;

create or replace function public.hash_arbitro_password() returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.password is not null and new.password !~ '^\$2[aby]\$' then
    new.password := crypt(new.password, gen_salt('bf'));
  end if;
  return new;
end;
$$;

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

-- 3) Funciones de verificación: reciben email + contraseña en texto plano
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
set search_path = public, extensions
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
set search_path = public, extensions
as $$
  select (to_jsonb(c) - 'delegado_pass')
         || jsonb_build_object('liga', jsonb_build_object('nombre', l.nombre, 'deporte', l.deporte))
  from public.clubes c
  left join public.ligas l on l.id = c.liga_id
  where c.delegado_email = p_email
    and c.delegado_pass is not null
    and c.delegado_pass = crypt(p_pass, c.delegado_pass)
  limit 1
$$;

create or replace function public.verificar_login_arbitro(p_email text, p_pass text)
returns jsonb
language sql
security definer
set search_path = public, extensions
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


-- ============ ETAPA B — correr después de desplegar el nuevo prototipo.html ============
-- El front en este mismo cambio ya dejó de hacer select('*') (o cualquier
-- select explícito de la columna de contraseña) sobre ligas/clubes/arbitros,
-- y el login ahora usa las funciones RPC de arriba. Recién con eso
-- desplegado tiene sentido correr esto — si lo corrés antes, cualquier
-- pantalla que todavía pida esa columna empieza a tirar error.
--
-- Solo se revoca SELECT, no UPDATE/INSERT: la escritura sigue igual que hoy
-- (los triggers de arriba se encargan de hashear).

revoke select (admin_pass)    on public.ligas    from anon, authenticated;
revoke select (delegado_pass) on public.clubes   from anon, authenticated;
revoke select (password)      on public.arbitros from anon, authenticated;
