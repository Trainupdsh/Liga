-- =============================================
-- FASE 3, TANDA 1 — BLINDAR LAS TABLAS ESTRUCTURALES
-- =============================================
-- Primera tanda de políticas RLS, sobre las tablas que definen la estructura
-- del sistema: ligas, planes, torneos y divisiones. Son las de mayor impacto
-- si alguien las toca (borrar una liga o un torneo se lleva todo lo que
-- cuelga) y a la vez las más simples de razonar, porque solo las administra
-- el admin de la liga o el superadmin.
--
-- REQUISITO: la migración 005 tiene que estar aplicada y el sitio publicado
-- tiene que estar mandando el token de sesión (confirmado con el cartel
-- verde "Sesión reconocida por el servidor"). Sin eso, esto deja la app sin
-- poder escribir nada.
--
-- CRITERIO GENERAL:
--   * LECTURA: sigue siendo pública. La home, el fixture y las posiciones
--     tienen que verse sin loguearse, como hasta ahora.
--   * ESCRITURA: solo el admin de esa liga o el superadmin.
--
-- Al final del archivo hay un bloque de EMERGENCIA para revertir esta tanda
-- si algo se rompe. Tenelo a mano mientras probás.
--
-- Correla entera en el SQL Editor de Supabase. Es idempotente.
-- =============================================


-- Ayudante: de qué liga es un torneo (lo necesitan las divisiones, que
-- cuelgan del torneo y no tienen liga_id propio).
create or replace function public.liga_de_torneo(p_torneo_id bigint)
returns bigint
language sql stable security definer set search_path = public
as $$ select liga_id from public.torneos where id = p_torneo_id $$;

grant execute on function public.liga_de_torneo(bigint) to anon, authenticated;


-- =========== LIGAS ===========
-- Crear y borrar ligas: solo el superadmin. Editar: el superadmin o el
-- admin de esa liga (para cambiar nombre, logo, colores, etc.).
alter table public.ligas enable row level security;

drop policy if exists ligas_lectura_publica on public.ligas;
create policy ligas_lectura_publica on public.ligas
  for select using (true);

drop policy if exists ligas_alta_superadmin on public.ligas;
create policy ligas_alta_superadmin on public.ligas
  for insert with check (public.sesion_rol() = 'superadmin');

drop policy if exists ligas_edicion on public.ligas;
create policy ligas_edicion on public.ligas
  for update using (public.puede_administrar_liga(id))
         with check (public.puede_administrar_liga(id));

drop policy if exists ligas_baja_superadmin on public.ligas;
create policy ligas_baja_superadmin on public.ligas
  for delete using (public.sesion_rol() = 'superadmin');


-- =========== PLANES ===========
-- Catálogo de planes de suscripción: lo ve todo el mundo (la app muestra
-- qué incluye cada plan), pero solo el superadmin lo modifica.
alter table public.planes enable row level security;

drop policy if exists planes_lectura_publica on public.planes;
create policy planes_lectura_publica on public.planes
  for select using (true);

drop policy if exists planes_escritura_superadmin on public.planes;
create policy planes_escritura_superadmin on public.planes
  for all using (public.sesion_rol() = 'superadmin')
      with check (public.sesion_rol() = 'superadmin');


-- =========== TORNEOS ===========
alter table public.torneos enable row level security;

drop policy if exists torneos_lectura_publica on public.torneos;
create policy torneos_lectura_publica on public.torneos
  for select using (true);

drop policy if exists torneos_escritura_admin on public.torneos;
create policy torneos_escritura_admin on public.torneos
  for all using (public.puede_administrar_liga(liga_id))
      with check (public.puede_administrar_liga(liga_id));


-- =========== DIVISIONES ===========
-- Cuelgan de un torneo; la liga se resuelve a través de él.
alter table public.divisiones enable row level security;

drop policy if exists divisiones_lectura_publica on public.divisiones;
create policy divisiones_lectura_publica on public.divisiones
  for select using (true);

drop policy if exists divisiones_escritura_admin on public.divisiones;
create policy divisiones_escritura_admin on public.divisiones
  for all using (public.puede_administrar_liga(public.liga_de_torneo(torneo_id)))
      with check (public.puede_administrar_liga(public.liga_de_torneo(torneo_id)));


-- =============================================
-- EMERGENCIA — REVERTIR ESTA TANDA
-- =============================================
-- Si después de aplicar esto alguna pantalla deja de guardar y no se puede
-- resolver en el momento, copiá y ejecutá SOLO estas cuatro líneas. Vuelven
-- las tablas al comportamiento anterior (todos pueden escribir). Las
-- políticas quedan definidas pero inactivas, así que reactivar es tan
-- simple como volver a poner "enable".
--
--     alter table public.ligas      disable row level security;
--     alter table public.planes     disable row level security;
--     alter table public.torneos    disable row level security;
--     alter table public.divisiones disable row level security;
