-- =============================================
-- COLUMNAS QUE EL CÓDIGO USA Y LA TABLA NO TENÍA
-- =============================================
-- Al cruzar el código contra el esquema real aparecieron seis funciones que
-- guardaban campos inexistentes y por eso fallaban siempre, en silencio:
-- comunicados, multas, marcar multa como pagada, informe del árbitro, alta de
-- cancha y solicitud de inscripción.
--
-- La mayoría se arregló del lado del código, usando los nombres que la base ya
-- tenía (titulo/cuerpo, estado, delegado_email...). Pero quedaron cuatro datos
-- que el formulario pide y no tenían dónde guardarse. Esta migración les hace
-- lugar.
--
-- NO es urgente ni bloqueante: el código ya funciona sin esto — si la columna
-- no existe, guarda el resto del registro y descarta ese campo. Corriendo esta
-- migración se deja de perder ese dato.
--
-- Correla en el SQL Editor de Supabase. Es idempotente y no toca datos
-- existentes: solo agrega columnas vacías.
-- =============================================

-- El texto libre de a quién se le aplica la multa ("club o jugador"). La tabla
-- solo tenía club_id, que no sirve para multar a un jugador ni para dejar
-- asentado un destinatario que todavía no está cargado como club.
alter table public.multas
  add column if not exists destinatario text;

-- Capacidad de espectadores de la cancha.
alter table public.canchas
  add column if not exists capacidad integer;

-- Calificación del encuentro que pone el árbitro en su informe. Es distinta de
-- condicion_cancha, que califica el estado del campo de juego.
alter table public.informe_arbitro
  add column if not exists calificacion text;

-- Mensaje libre que escribe quien solicita inscribir su club a la liga.
alter table public.solicitudes_inscripcion
  add column if not exists mensaje text;
