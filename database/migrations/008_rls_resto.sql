-- =============================================
-- FASE 3, TANDA FINAL — TODAS LAS TABLAS RESTANTES
-- =============================================
-- Cierra el blindaje con las 11 tablas que faltaban: el plantel (equipos,
-- jugadores, cuerpo técnico, alineaciones), los partidos y todo lo que
-- cuelga de ellos (eventos, informes de árbitro, votos), y los formularios
-- públicos (solicitudes de inscripción, consultas), más el historial.
--
-- REQUISITO: tener aplicadas las migraciones 005, 006 y 007.
--
-- Acá aparecen dos situaciones nuevas respecto de las tandas anteriores:
--
--   1) EL DELEGADO MANEJA SU PLANTEL. Puede dar de alta y editar los
--      jugadores y el cuerpo técnico de SU club, y solo de su club.
--
--   2) EL ÁRBITRO CARGA LO SUYO. Puede actualizar el partido que le
--      asignaron y cargar sus eventos e informe — solo de los partidos que
--      efectivamente le tocan.
--
-- Y tres tablas cambian de criterio en la LECTURA, porque contienen datos
-- que hoy son públicos y no deberían serlo:
--
--   * solicitudes_inscripcion: tiene email y teléfono de quien se quiere
--     inscribir. Pasa a leerse solo por el admin de esa liga.
--   * consultas: son los mensajes del formulario de contacto, con datos de
--     contacto de la gente. Pasa a leerse solo por el superadmin.
--   * informe_arbitro: es el informe interno del árbitro sobre el partido.
--     Pasa a leerse solo por el admin de la liga y el árbitro que lo firmó.
--     (La app hoy lo escribe pero nunca lo lee, así que esto no rompe nada.)
--
-- Al final hay un bloque de EMERGENCIA con una línea POR TABLA, para poder
-- desactivar solo la que dé problemas sin tirar abajo el resto.
--
-- Correla entera en el SQL Editor de Supabase. Es idempotente.
-- =============================================


-- ============ AYUDANTES DE PARENTESCO ============
-- Resuelven a qué liga (o a qué club) pertenece cada cosa, subiendo por la
-- cadena equipos -> división -> torneo -> liga.

create or replace function public.liga_de_division(p_division_id bigint)
returns bigint language sql stable security definer set search_path = public
as $$ select t.liga_id from public.divisiones d join public.torneos t on t.id = d.torneo_id where d.id = p_division_id $$;

create or replace function public.liga_de_club(p_club_id bigint)
returns bigint language sql stable security definer set search_path = public
as $$ select liga_id from public.clubes where id = p_club_id $$;

create or replace function public.club_de_equipo(p_equipo_id bigint)
returns bigint language sql stable security definer set search_path = public
as $$ select club_id from public.equipos where id = p_equipo_id $$;

create or replace function public.liga_de_equipo(p_equipo_id bigint)
returns bigint language sql stable security definer set search_path = public
as $$ select public.liga_de_division(division_id) from public.equipos where id = p_equipo_id $$;

create or replace function public.liga_de_partido(p_partido_id bigint)
returns bigint language sql stable security definer set search_path = public
as $$ select public.liga_de_division(division_id) from public.partidos where id = p_partido_id $$;

-- ¿La sesión actual es la del árbitro designado para ese partido?
create or replace function public.es_arbitro_del_partido(p_partido_id bigint)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.partidos p
    where p.id = p_partido_id
      and public.sesion_rol() = 'arbitro'
      and p.arbitro_id is not null
      and p.arbitro_id = public.sesion_arbitro_id()
  )
$$;

grant execute on function public.liga_de_division(bigint)      to anon, authenticated;
grant execute on function public.liga_de_club(bigint)          to anon, authenticated;
grant execute on function public.club_de_equipo(bigint)        to anon, authenticated;
grant execute on function public.liga_de_equipo(bigint)        to anon, authenticated;
grant execute on function public.liga_de_partido(bigint)       to anon, authenticated;
grant execute on function public.es_arbitro_del_partido(bigint) to anon, authenticated;


-- ============ EQUIPOS ============
-- Los inscribe el admin de la liga (es quien arma las divisiones).
alter table public.equipos enable row level security;

drop policy if exists equipos_lectura_publica on public.equipos;
create policy equipos_lectura_publica on public.equipos for select using (true);

drop policy if exists equipos_escritura_admin on public.equipos;
create policy equipos_escritura_admin on public.equipos
  for all using (public.puede_administrar_liga(public.liga_de_division(division_id)))
      with check (public.puede_administrar_liga(public.liga_de_division(division_id)));


-- ============ JUGADORES ============
-- El admin de la liga, o el delegado del club dueño del equipo.
alter table public.jugadores enable row level security;

drop policy if exists jugadores_lectura_publica on public.jugadores;
create policy jugadores_lectura_publica on public.jugadores for select using (true);

drop policy if exists jugadores_escritura on public.jugadores;
create policy jugadores_escritura on public.jugadores
  for all using (
        public.puede_administrar_liga(public.liga_de_equipo(equipo_id))
     or (public.sesion_rol() = 'delegado' and public.club_de_equipo(equipo_id) = public.sesion_club_id())
  ) with check (
        public.puede_administrar_liga(public.liga_de_equipo(equipo_id))
     or (public.sesion_rol() = 'delegado' and public.club_de_equipo(equipo_id) = public.sesion_club_id())
  );


-- ============ CUERPO TÉCNICO ============
-- El admin de la liga, o el delegado de ese club.
alter table public.cuerpo_tecnico enable row level security;

drop policy if exists cuerpo_lectura_publica on public.cuerpo_tecnico;
create policy cuerpo_lectura_publica on public.cuerpo_tecnico for select using (true);

drop policy if exists cuerpo_escritura on public.cuerpo_tecnico;
create policy cuerpo_escritura on public.cuerpo_tecnico
  for all using (
        public.puede_administrar_liga(public.liga_de_club(club_id))
     or (public.sesion_rol() = 'delegado' and club_id = public.sesion_club_id())
  ) with check (
        public.puede_administrar_liga(public.liga_de_club(club_id))
     or (public.sesion_rol() = 'delegado' and club_id = public.sesion_club_id())
  );


-- ============ ALINEACIONES ============
-- La lista de quién juega cada partido: la carga el admin, el delegado del
-- equipo, o el árbitro designado.
alter table public.alineaciones enable row level security;

drop policy if exists alineaciones_lectura_publica on public.alineaciones;
create policy alineaciones_lectura_publica on public.alineaciones for select using (true);

drop policy if exists alineaciones_escritura on public.alineaciones;
create policy alineaciones_escritura on public.alineaciones
  for all using (
        public.puede_administrar_liga(public.liga_de_partido(partido_id))
     or (public.sesion_rol() = 'delegado' and public.club_de_equipo(equipo_id) = public.sesion_club_id())
     or public.es_arbitro_del_partido(partido_id)
  ) with check (
        public.puede_administrar_liga(public.liga_de_partido(partido_id))
     or (public.sesion_rol() = 'delegado' and public.club_de_equipo(equipo_id) = public.sesion_club_id())
     or public.es_arbitro_del_partido(partido_id)
  );


-- ============ PARTIDOS ============
-- Crear y borrar: solo el admin de la liga (arma el fixture).
-- Editar: el admin, o el árbitro designado (para cargar resultado y estado).
alter table public.partidos enable row level security;

drop policy if exists partidos_lectura_publica on public.partidos;
create policy partidos_lectura_publica on public.partidos for select using (true);

drop policy if exists partidos_alta_admin on public.partidos;
create policy partidos_alta_admin on public.partidos
  for insert with check (public.puede_administrar_liga(public.liga_de_division(division_id)));

drop policy if exists partidos_edicion on public.partidos;
create policy partidos_edicion on public.partidos
  for update using (
        public.puede_administrar_liga(public.liga_de_division(division_id))
     or public.es_arbitro_del_partido(id)
  ) with check (
        public.puede_administrar_liga(public.liga_de_division(division_id))
     or public.es_arbitro_del_partido(id)
  );

drop policy if exists partidos_baja_admin on public.partidos;
create policy partidos_baja_admin on public.partidos
  for delete using (public.puede_administrar_liga(public.liga_de_division(division_id)));


-- ============ EVENTOS DE PARTIDO ============
-- Goles, tarjetas, etc. Los carga el admin o el árbitro del partido.
alter table public.eventos_partido enable row level security;

drop policy if exists eventos_lectura_publica on public.eventos_partido;
create policy eventos_lectura_publica on public.eventos_partido for select using (true);

drop policy if exists eventos_escritura on public.eventos_partido;
create policy eventos_escritura on public.eventos_partido
  for all using (
        public.puede_administrar_liga(public.liga_de_partido(partido_id))
     or public.es_arbitro_del_partido(partido_id)
  ) with check (
        public.puede_administrar_liga(public.liga_de_partido(partido_id))
     or public.es_arbitro_del_partido(partido_id)
  );


-- ============ INFORME DEL ÁRBITRO ============
-- Documento interno: lo escribe el árbitro del partido y lo leen solo el
-- admin de la liga y el propio árbitro. Deja de ser de lectura pública.
alter table public.informe_arbitro enable row level security;

drop policy if exists informe_lectura on public.informe_arbitro;
create policy informe_lectura on public.informe_arbitro
  for select using (
        public.puede_administrar_liga(public.liga_de_partido(partido_id))
     or public.es_arbitro_del_partido(partido_id)
  );

drop policy if exists informe_escritura on public.informe_arbitro;
create policy informe_escritura on public.informe_arbitro
  for all using (
        public.puede_administrar_liga(public.liga_de_partido(partido_id))
     or public.es_arbitro_del_partido(partido_id)
  ) with check (
        public.puede_administrar_liga(public.liga_de_partido(partido_id))
     or public.es_arbitro_del_partido(partido_id)
  );


-- ============ VOTOS DE PARTIDO ============
-- Encuesta pública de pronósticos: cualquiera puede votar, por diseño.
-- Lo único que se protege es que nadie borre la votación entera.
alter table public.votos_partido enable row level security;

drop policy if exists votos_lectura_publica on public.votos_partido;
create policy votos_lectura_publica on public.votos_partido for select using (true);

drop policy if exists votos_alta_publica on public.votos_partido;
create policy votos_alta_publica on public.votos_partido for insert with check (true);

drop policy if exists votos_cambio_publico on public.votos_partido;
create policy votos_cambio_publico on public.votos_partido
  for update using (true) with check (true);

drop policy if exists votos_baja_admin on public.votos_partido;
create policy votos_baja_admin on public.votos_partido
  for delete using (public.puede_administrar_liga(public.liga_de_partido(partido_id)));


-- ============ SOLICITUDES DE INSCRIPCIÓN ============
-- Formulario público: cualquiera manda una solicitud. Pero contiene email y
-- teléfono del solicitante, así que solo la lee el admin de esa liga.
alter table public.solicitudes_inscripcion enable row level security;

drop policy if exists solicitudes_alta_publica on public.solicitudes_inscripcion;
create policy solicitudes_alta_publica on public.solicitudes_inscripcion
  for insert with check (true);

drop policy if exists solicitudes_lectura_admin on public.solicitudes_inscripcion;
create policy solicitudes_lectura_admin on public.solicitudes_inscripcion
  for select using (public.puede_administrar_liga(liga_id));

drop policy if exists solicitudes_edicion_admin on public.solicitudes_inscripcion;
create policy solicitudes_edicion_admin on public.solicitudes_inscripcion
  for update using (public.puede_administrar_liga(liga_id))
         with check (public.puede_administrar_liga(liga_id));

drop policy if exists solicitudes_baja_admin on public.solicitudes_inscripcion;
create policy solicitudes_baja_admin on public.solicitudes_inscripcion
  for delete using (public.puede_administrar_liga(liga_id));


-- ============ CONSULTAS (formulario de contacto) ============
-- Cualquiera puede escribir. Solo el superadmin las lee y gestiona, que es
-- como funciona hoy el panel. No tiene liga_id para acotarlas.
alter table public.consultas enable row level security;

drop policy if exists consultas_alta_publica on public.consultas;
create policy consultas_alta_publica on public.consultas
  for insert with check (true);

drop policy if exists consultas_gestion_superadmin on public.consultas;
create policy consultas_gestion_superadmin on public.consultas
  for select using (public.sesion_rol() = 'superadmin');

drop policy if exists consultas_edicion_superadmin on public.consultas;
create policy consultas_edicion_superadmin on public.consultas
  for update using (public.sesion_rol() = 'superadmin')
         with check (public.sesion_rol() = 'superadmin');

drop policy if exists consultas_baja_superadmin on public.consultas;
create policy consultas_baja_superadmin on public.consultas
  for delete using (public.sesion_rol() = 'superadmin');


-- ============ HISTORIAL DE TEMPORADAS ============
alter table public.historial_temporadas enable row level security;

drop policy if exists historial_lectura_publica on public.historial_temporadas;
create policy historial_lectura_publica on public.historial_temporadas
  for select using (true);

drop policy if exists historial_escritura_admin on public.historial_temporadas;
create policy historial_escritura_admin on public.historial_temporadas
  for all using (public.puede_administrar_liga(liga_id))
      with check (public.puede_administrar_liga(liga_id));


-- =============================================
-- EMERGENCIA — UNA LÍNEA POR TABLA
-- =============================================
-- Si una pantalla puntual deja de guardar, ejecutá SOLO la línea de esa
-- tabla. El resto del blindaje sigue en pie. Después avisame cuál fue y lo
-- corrijo, en vez de dejarlo desactivado.
--
--     alter table public.equipos                 disable row level security;
--     alter table public.jugadores               disable row level security;
--     alter table public.cuerpo_tecnico          disable row level security;
--     alter table public.alineaciones            disable row level security;
--     alter table public.partidos                disable row level security;
--     alter table public.eventos_partido         disable row level security;
--     alter table public.informe_arbitro         disable row level security;
--     alter table public.votos_partido           disable row level security;
--     alter table public.solicitudes_inscripcion disable row level security;
--     alter table public.consultas               disable row level security;
--     alter table public.historial_temporadas    disable row level security;
