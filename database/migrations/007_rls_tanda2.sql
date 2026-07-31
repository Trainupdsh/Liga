-- =============================================
-- FASE 3, TANDA 2 — ENTIDADES QUE PERTENECEN A UNA LIGA
-- =============================================
-- Segunda tanda de políticas RLS: clubes, árbitros, canchas, comunicados y
-- multas. Todas tienen una columna liga_id, así que la regla base es la
-- misma que en la tanda 1: las administra el admin de esa liga (o el
-- superadmin) y nadie más.
--
-- La excepción es "clubes": además del admin de la liga, el delegado puede
-- editar su propio club (nombre, escudo, dirección, colores), que es algo
-- que la app ya permite hoy desde el panel del delegado.
--
-- REQUISITO: tener aplicada la tanda 1 (migración 006) y haber comprobado
-- que la app sigue funcionando con ella.
--
-- CRITERIO:
--   * LECTURA: sigue pública, igual que hasta ahora.
--   * ESCRITURA: admin de esa liga o superadmin. Más el delegado sobre su
--     propio club.
--
-- Al final hay un bloque de EMERGENCIA para revertir esta tanda.
--
-- Correla entera en el SQL Editor de Supabase. Es idempotente.
-- =============================================


-- =========== CLUBES ===========
-- Alta y baja: el admin de la liga. Edición: el admin de la liga o el
-- delegado de ese club.
alter table public.clubes enable row level security;

drop policy if exists clubes_lectura_publica on public.clubes;
create policy clubes_lectura_publica on public.clubes
  for select using (true);

drop policy if exists clubes_alta_admin on public.clubes;
create policy clubes_alta_admin on public.clubes
  for insert with check (public.puede_administrar_liga(liga_id));

drop policy if exists clubes_edicion on public.clubes;
create policy clubes_edicion on public.clubes
  for update using (
        public.puede_administrar_liga(liga_id)
     or (public.sesion_rol() = 'delegado' and id = public.sesion_club_id())
  ) with check (
        public.puede_administrar_liga(liga_id)
     or (public.sesion_rol() = 'delegado' and id = public.sesion_club_id())
  );

drop policy if exists clubes_baja_admin on public.clubes;
create policy clubes_baja_admin on public.clubes
  for delete using (public.puede_administrar_liga(liga_id));


-- =========== ARBITROS ===========
-- Los da de alta y los administra el admin de la liga.
-- NOTA: la lectura queda pública para no romper las pantallas que muestran
-- quién dirige cada partido. La columna password ya está fuera del alcance
-- de cualquiera desde la migración 003. Queda pendiente revisar si conviene
-- restringir también email y teléfono, que hoy son visibles.
alter table public.arbitros enable row level security;

drop policy if exists arbitros_lectura_publica on public.arbitros;
create policy arbitros_lectura_publica on public.arbitros
  for select using (true);

drop policy if exists arbitros_escritura_admin on public.arbitros;
create policy arbitros_escritura_admin on public.arbitros
  for all using (public.puede_administrar_liga(liga_id))
      with check (public.puede_administrar_liga(liga_id));


-- =========== CANCHAS ===========
alter table public.canchas enable row level security;

drop policy if exists canchas_lectura_publica on public.canchas;
create policy canchas_lectura_publica on public.canchas
  for select using (true);

drop policy if exists canchas_escritura_admin on public.canchas;
create policy canchas_escritura_admin on public.canchas
  for all using (public.puede_administrar_liga(liga_id))
      with check (public.puede_administrar_liga(liga_id));


-- =========== COMUNICADOS ===========
alter table public.comunicados enable row level security;

drop policy if exists comunicados_lectura_publica on public.comunicados;
create policy comunicados_lectura_publica on public.comunicados
  for select using (true);

drop policy if exists comunicados_escritura_admin on public.comunicados;
create policy comunicados_escritura_admin on public.comunicados
  for all using (public.puede_administrar_liga(liga_id))
      with check (public.puede_administrar_liga(liga_id));


-- =========== MULTAS ===========
alter table public.multas enable row level security;

drop policy if exists multas_lectura_publica on public.multas;
create policy multas_lectura_publica on public.multas
  for select using (true);

drop policy if exists multas_escritura_admin on public.multas;
create policy multas_escritura_admin on public.multas
  for all using (public.puede_administrar_liga(liga_id))
      with check (public.puede_administrar_liga(liga_id));


-- =============================================
-- EMERGENCIA — REVERTIR ESTA TANDA
-- =============================================
-- Si algo deja de guardar y no se resuelve en el momento, copiá y ejecutá
-- solo estas líneas. Las políticas quedan definidas pero inactivas.
--
--     alter table public.clubes      disable row level security;
--     alter table public.arbitros    disable row level security;
--     alter table public.canchas     disable row level security;
--     alter table public.comunicados disable row level security;
--     alter table public.multas      disable row level security;
