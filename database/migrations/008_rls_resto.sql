-- =============================================
-- FASE 3, TANDA FINAL — TODO LO QUE QUEDABA
-- =============================================
-- Cierra el blindaje. Esta versión está escrita contra la estructura REAL
-- de la base (relevada con information_schema), no sobre suposiciones.
-- Al hacer ese relevamiento aparecieron dos cosas que corrigen lo anterior:
--
--   1) historial_temporadas cuelga de division_id, NO de liga_id (eso era
--      lo que hacía fallar la versión anterior de este archivo).
--
--   2) Había 11 tablas más que no estaban en el plan, porque la app no las
--      nombra: posiciones, lista_buena_fe, reglas_torneo, usuarios, y las
--      siete de un backend anterior (admin_users, leagues, teams, players,
--      matches, player_events, sports). Estaban abiertas de par en par.
--      admin_users guarda contraseñas.
--
-- REQUISITO: tener aplicadas las migraciones 005, 006 y 007.
--
-- Al final hay un bloque de EMERGENCIA con una línea POR TABLA.
--
-- Correla entera en el SQL Editor de Supabase. Es idempotente.
-- =============================================


-- ============ AYUDANTES DE PARENTESCO ============
-- Resuelven a qué liga o club pertenece cada cosa, subiendo por la cadena
-- equipo -> división -> torneo -> liga.

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

grant execute on function public.liga_de_division(bigint)       to anon, authenticated;
grant execute on function public.liga_de_club(bigint)           to anon, authenticated;
grant execute on function public.club_de_equipo(bigint)         to anon, authenticated;
grant execute on function public.liga_de_equipo(bigint)         to anon, authenticated;
grant execute on function public.liga_de_partido(bigint)        to anon, authenticated;
grant execute on function public.es_arbitro_del_partido(bigint) to anon, authenticated;


-- ============ EQUIPOS ============
alter table public.equipos enable row level security;

drop policy if exists equipos_lectura_publica on public.equipos;
create policy equipos_lectura_publica on public.equipos for select using (true);

drop policy if exists equipos_escritura_admin on public.equipos;
create policy equipos_escritura_admin on public.equipos
  for all using (public.puede_administrar_liga(public.liga_de_division(division_id)))
      with check (public.puede_administrar_liga(public.liga_de_division(division_id)));


-- ============ JUGADORES ============
-- La tabla tiene club_id (del esquema viejo) y equipo_id (el que usa la app
-- hoy). Se contemplan los dos: si un jugador quedó sin equipo_id asignado,
-- se resuelve por club_id y no se bloquea a quien corresponde.
alter table public.jugadores enable row level security;

drop policy if exists jugadores_lectura_publica on public.jugadores;
create policy jugadores_lectura_publica on public.jugadores for select using (true);

drop policy if exists jugadores_escritura on public.jugadores;
create policy jugadores_escritura on public.jugadores
  for all using (
        public.puede_administrar_liga(coalesce(public.liga_de_equipo(equipo_id), public.liga_de_club(club_id)))
     or (public.sesion_rol() = 'delegado'
         and coalesce(public.club_de_equipo(equipo_id), club_id) = public.sesion_club_id())
  ) with check (
        public.puede_administrar_liga(coalesce(public.liga_de_equipo(equipo_id), public.liga_de_club(club_id)))
     or (public.sesion_rol() = 'delegado'
         and coalesce(public.club_de_equipo(equipo_id), club_id) = public.sesion_club_id())
  );


-- ============ CUERPO TÉCNICO ============
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


-- ============ LISTA DE BUENA FE ============
-- Mismo criterio que alineaciones (la app todavía no la usa, pero está).
alter table public.lista_buena_fe enable row level security;

drop policy if exists buenafe_lectura_publica on public.lista_buena_fe;
create policy buenafe_lectura_publica on public.lista_buena_fe for select using (true);

drop policy if exists buenafe_escritura on public.lista_buena_fe;
create policy buenafe_escritura on public.lista_buena_fe
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
-- Crear y borrar: el admin de la liga (arma el fixture).
-- Editar: el admin, o el árbitro designado (resultado y estado).
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


-- ============ POSICIONES ============
-- Tabla de puntajes. La app hoy las calcula sola, pero la tabla existe y
-- estaba abierta: cualquiera podía reescribir la tabla de posiciones.
alter table public.posiciones enable row level security;

drop policy if exists posiciones_lectura_publica on public.posiciones;
create policy posiciones_lectura_publica on public.posiciones for select using (true);

drop policy if exists posiciones_escritura_admin on public.posiciones;
create policy posiciones_escritura_admin on public.posiciones
  for all using (public.puede_administrar_liga(public.liga_de_division(division_id)))
      with check (public.puede_administrar_liga(public.liga_de_division(division_id)));


-- ============ REGLAS DEL TORNEO ============
-- Puntos por victoria, criterios de desempate, fechas de suspensión.
alter table public.reglas_torneo enable row level security;

drop policy if exists reglas_lectura_publica on public.reglas_torneo;
create policy reglas_lectura_publica on public.reglas_torneo for select using (true);

drop policy if exists reglas_escritura_admin on public.reglas_torneo;
create policy reglas_escritura_admin on public.reglas_torneo
  for all using (public.puede_administrar_liga(public.liga_de_torneo(torneo_id)))
      with check (public.puede_administrar_liga(public.liga_de_torneo(torneo_id)));


-- ============ INFORME DEL ÁRBITRO ============
-- Documento interno: lo escribe el árbitro del partido, y lo leen solo el
-- admin de la liga y ese árbitro. Deja de ser de lectura pública.
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
-- Encuesta pública de pronósticos: cualquiera vota, por diseño. Lo único
-- que se protege es que nadie borre la votación entera.
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
-- Formulario público: cualquiera manda una solicitud. Pero guarda nombre,
-- email y teléfono del delegado, así que solo la lee el admin de esa liga.
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
-- Cualquiera escribe; solo el superadmin lee y gestiona, que es como
-- funciona el panel hoy. No tiene liga_id para acotarlas.
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
-- OJO: cuelga de division_id, no de liga_id. Era el error que frenaba la
-- versión anterior de este archivo.
alter table public.historial_temporadas enable row level security;

drop policy if exists historial_lectura_publica on public.historial_temporadas;
create policy historial_lectura_publica on public.historial_temporadas
  for select using (true);

drop policy if exists historial_escritura_admin on public.historial_temporadas;
create policy historial_escritura_admin on public.historial_temporadas
  for all using (public.puede_administrar_liga(public.liga_de_division(division_id)))
      with check (public.puede_administrar_liga(public.liga_de_division(division_id)));


-- ============ USUARIOS ============
-- Tabla con emails y roles. La app no la usa, pero está y expone datos de
-- contacto. Lectura y escritura quedan para el admin de esa liga.
alter table public.usuarios enable row level security;

drop policy if exists usuarios_acceso_admin on public.usuarios;
create policy usuarios_acceso_admin on public.usuarios
  for all using (public.puede_administrar_liga(liga_id))
      with check (public.puede_administrar_liga(liga_id));


-- ============ TABLAS DE UN BACKEND ANTERIOR ============
-- admin_users, leagues, teams, players, matches, player_events y sports son
-- de otra versión del sistema (el backend Node del repositorio). La app que
-- está online no las toca, pero seguían accesibles para cualquiera —
-- admin_users incluso guarda contraseñas.
--
-- Se les activa RLS sin ninguna política: eso niega todo acceso por la API
-- pública. Las conexiones directas a la base (el backend Node, si alguna vez
-- se usa, y las herramientas de Supabase) no se ven afectadas, porque el
-- usuario dueño de la base no está sujeto a RLS.
alter table public.admin_users   enable row level security;
alter table public.leagues       enable row level security;
alter table public.teams         enable row level security;
alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.player_events enable row level security;
alter table public.sports        enable row level security;


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
--     alter table public.lista_buena_fe          disable row level security;
--     alter table public.partidos                disable row level security;
--     alter table public.eventos_partido         disable row level security;
--     alter table public.posiciones              disable row level security;
--     alter table public.reglas_torneo           disable row level security;
--     alter table public.informe_arbitro         disable row level security;
--     alter table public.votos_partido           disable row level security;
--     alter table public.solicitudes_inscripcion disable row level security;
--     alter table public.consultas               disable row level security;
--     alter table public.historial_temporadas    disable row level security;
--     alter table public.usuarios                disable row level security;
