import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Result form
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState(null);

  // Add event form
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventError, setEventError] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);

  const loadMatch = async () => {
    try {
      const [matchesRes, eventsRes] = await Promise.all([
        adminApi.getMatches(),
        adminApi.getMatchEvents(id),
      ]);

      const found = matchesRes.data.find((m) => m.id === id);
      if (!found) {
        setError('Partido no encontrado');
        return;
      }

      setMatch(found);
      setEvents(eventsRes.data);

      // Preset scores if already finished
      if (found.status === 'finished') {
        setHomeScore(found.home_score?.toString() || '0');
        setAwayScore(found.away_score?.toString() || '0');
      }

      // Load players from both teams
      const [homePlayers, awayPlayers] = await Promise.all([
        adminApi.getPlayers(found.home_team_id),
        adminApi.getPlayers(found.away_team_id),
      ]);

      setPlayers([...homePlayers.data, ...awayPlayers.data]);
    } catch (err) {
      setError('Error al cargar el partido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatch();
  }, [id]);

  const handleSetResult = async (e) => {
    e.preventDefault();
    if (homeScore === '' || awayScore === '') {
      setResultError('Debés ingresar ambos scores');
      return;
    }

    setSavingResult(true);
    setResultError(null);
    try {
      const res = await adminApi.setResult(id, {
        home_score: parseInt(homeScore),
        away_score: parseInt(awayScore),
      });

      setMatch((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      setResultError(err.response?.data?.error || 'Error al guardar el resultado');
    } finally {
      setSavingResult(false);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!selectedPlayerId || !selectedTeamId) {
      setEventError('Seleccioná un jugador');
      return;
    }

    setAddingEvent(true);
    setEventError(null);
    try {
      const res = await adminApi.addMatchEvent(id, {
        player_id: selectedPlayerId,
        team_id: selectedTeamId,
        event_type: 'goal',
        value: 1,
      });

      setEvents((prev) => [...prev, res.data]);
      setSelectedPlayerId('');
      setSelectedTeamId('');
    } catch (err) {
      setEventError(err.response?.data?.error || 'Error al agregar el gol');
    } finally {
      setAddingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    setDeletingEventId(eventId);
    try {
      await adminApi.deleteMatchEvent(id, eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el gol');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handlePlayerChange = (playerId) => {
    setSelectedPlayerId(playerId);
    if (playerId) {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        setSelectedTeamId(player.team_id);
      }
    } else {
      setSelectedTeamId('');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-6 animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-10 text-center">
          <p className="text-gray-700">{error}</p>
          <Link to="/admin/partidos" className="mt-4 inline-block btn-primary text-sm">
            Volver a partidos
          </Link>
        </div>
      </div>
    );
  }

  const homeTeam = {
    id: match.home_team_id,
    name: match.home_team_name,
    short_name: match.home_team_short_name,
    shield_url: match.home_team_shield_url,
  };
  const awayTeam = {
    id: match.away_team_id,
    name: match.away_team_name,
    short_name: match.away_team_short_name,
    shield_url: match.away_team_shield_url,
  };

  const homeEvents = events.filter((e) => e.team_id === match.home_team_id);
  const awayEvents = events.filter((e) => e.team_id === match.away_team_id);

  const homePlayers = players.filter((p) => p.team_id === match.home_team_id);
  const awayPlayers = players.filter((p) => p.team_id === match.away_team_id);
  const allPlayersForTeam = selectedTeamId
    ? players.filter((p) => p.team_id === selectedTeamId)
    : players;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link
        to="/admin/partidos"
        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a partidos
      </Link>

      {/* Match header */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Home team */}
          <div className="flex flex-col items-center gap-2 flex-1 text-center">
            <TeamShield team={homeTeam} size="xl" />
            <p className="font-bold text-gray-900 text-sm">{homeTeam.name}</p>
          </div>

          {/* Score */}
          <div className="text-center px-4">
            {match.status === 'finished' ? (
              <p className="text-4xl font-bold text-gray-900">
                {match.home_score} - {match.away_score}
              </p>
            ) : (
              <p className="text-gray-400 font-semibold">VS</p>
            )}
            <span
              className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                match.status === 'finished'
                  ? 'bg-green-100 text-green-700'
                  : match.status === 'cancelled'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {match.status === 'finished'
                ? 'Finalizado'
                : match.status === 'cancelled'
                ? 'Cancelado'
                : 'Programado'}
            </span>
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1 text-center">
            <TeamShield team={awayTeam} size="xl" />
            <p className="font-bold text-gray-900 text-sm">{awayTeam.name}</p>
          </div>
        </div>

        {match.round && (
          <p className="text-center text-sm text-gray-500">Jornada {match.round}</p>
        )}
        {match.venue && (
          <p className="text-center text-sm text-gray-500 mt-1">📍 {match.venue}</p>
        )}
      </div>

      {/* Set result */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-900 mb-4">
          {match.status === 'finished' ? 'Actualizar resultado' : 'Cargar resultado'}
        </h2>

        {resultError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {resultError}
          </div>
        )}

        <form onSubmit={handleSetResult}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1 text-center">
                {homeTeam.short_name || homeTeam.name}
              </label>
              <input
                type="number"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="input-field text-center text-2xl font-bold"
                placeholder="0"
                min={0}
                required
              />
            </div>
            <span className="text-2xl text-gray-400 font-bold pb-1">-</span>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1 text-center">
                {awayTeam.short_name || awayTeam.name}
              </label>
              <input
                type="number"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="input-field text-center text-2xl font-bold"
                placeholder="0"
                min={0}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingResult}
            className="w-full btn-primary mt-4"
          >
            {savingResult ? 'Guardando...' : match.status === 'finished' ? 'Actualizar resultado' : 'Marcar como finalizado'}
          </button>
        </form>
      </div>

      {/* Scorers */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-900 mb-4">Goleadores</h2>

        {/* Add scorer */}
        {eventError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {eventError}
          </div>
        )}

        <form onSubmit={handleAddEvent} className="flex gap-2 mb-4">
          <select
            value={selectedPlayerId}
            onChange={(e) => handlePlayerChange(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">Seleccionar jugador</option>
            <optgroup label={homeTeam.name}>
              {homePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey_number ? `#${p.jersey_number} ` : ''}{p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={awayTeam.name}>
              {awayPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey_number ? `#${p.jersey_number} ` : ''}{p.name}
                </option>
              ))}
            </optgroup>
          </select>

          <button
            type="submit"
            disabled={addingEvent || !selectedPlayerId}
            className="btn-primary px-4 flex-shrink-0"
          >
            {addingEvent ? '...' : '⚽ Gol'}
          </button>
        </form>

        {/* Events list */}
        {events.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No hay goles registrados</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Home scorers */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">{homeTeam.name}</p>
              {homeEvents.length === 0 ? (
                <p className="text-xs text-gray-400">Sin goles</p>
              ) : (
                <ul className="space-y-1.5">
                  {homeEvents.map((ev) => (
                    <li key={ev.id} className="flex items-center gap-2 text-sm group">
                      <span>⚽</span>
                      <span className="flex-1">{ev.player_name}</span>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        disabled={deletingEventId === ev.id}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Quitar gol"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Away scorers */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">{awayTeam.name}</p>
              {awayEvents.length === 0 ? (
                <p className="text-xs text-gray-400">Sin goles</p>
              ) : (
                <ul className="space-y-1.5">
                  {awayEvents.map((ev) => (
                    <li key={ev.id} className="flex items-center gap-2 text-sm group">
                      <span>⚽</span>
                      <span className="flex-1">{ev.player_name}</span>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        disabled={deletingEventId === ev.id}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Quitar gol"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
