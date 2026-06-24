import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function formatDatetime(dateStr) {
  if (!dateStr) return 'Sin fecha';
  try {
    return format(parseISO(dateStr), "d MMM · HH:mm", { locale: es });
  } catch {
    return dateStr;
  }
}

function MatchModal({ match, teams, onClose, onSave }) {
  const [homeTeamId, setHomeTeamId] = useState(match?.home_team_id || '');
  const [awayTeamId, setAwayTeamId] = useState(match?.away_team_id || '');
  const [round, setRound] = useState(match?.round || '');
  const [scheduledAt, setScheduledAt] = useState(
    match?.scheduled_at ? match.scheduled_at.slice(0, 16) : ''
  );
  const [venue, setVenue] = useState(match?.venue || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId) {
      setError('Debés seleccionar ambos equipos');
      return;
    }
    if (homeTeamId === awayTeamId) {
      setError('Los equipos deben ser distintos');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = {
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        round: round || null,
        scheduled_at: scheduledAt || null,
        venue: venue || null,
      };

      let result;
      if (match) {
        result = await adminApi.updateMatch(match.id, data);
      } else {
        result = await adminApi.createMatch(data);
      }

      onSave(result.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el partido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {match ? 'Editar partido' : 'Nuevo partido'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipo local *</label>
            <select
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Seleccionar equipo local</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipo visitante *</label>
            <select
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Seleccionar equipo visitante</option>
              {teams.filter((t) => t.id !== homeTeamId).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jornada</label>
              <input
                type="number"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="input-field"
                placeholder="Ej: 1"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sede</label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="input-field"
                placeholder="Cancha..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary">
              {saving ? 'Guardando...' : match ? 'Guardar cambios' : 'Crear partido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const statusBadge = {
  scheduled: { label: 'Programado', class: 'bg-blue-100 text-blue-700' },
  finished: { label: 'Finalizado', class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', class: 'bg-red-100 text-red-700' },
};

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [matchesRes, teamsRes] = await Promise.all([
        adminApi.getMatches(),
        adminApi.getTeams(),
      ]);
      setMatches(matchesRes.data);
      setTeams(teamsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = (savedMatch) => {
    if (editingMatch) {
      setMatches((prev) => prev.map((m) => (m.id === savedMatch.id ? savedMatch : m)));
    } else {
      setMatches((prev) => [...prev, savedMatch]);
    }
    setShowModal(false);
    setEditingMatch(null);
    // Reload to get full joined data
    adminApi.getMatches().then((res) => setMatches(res.data));
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que querés eliminar este partido?')) return;
    setDeletingId(id);
    try {
      await adminApi.deleteMatch(id);
      setMatches((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el partido');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredMatches = filterStatus
    ? matches.filter((m) => m.status === filterStatus)
    : matches;

  // Group by round
  const groupedMatches = filteredMatches.reduce((acc, m) => {
    const key = m.round || 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});
  const rounds = Object.keys(groupedMatches).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidos</h1>
          <p className="text-gray-500 text-sm mt-1">{matches.length} partido{matches.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditingMatch(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo partido
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <div className="flex gap-2">
          {[
            { value: '', label: 'Todos' },
            { value: 'scheduled', label: 'Programados' },
            { value: 'finished', label: 'Finalizados' },
            { value: 'cancelled', label: 'Cancelados' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">⚽</p>
          <p>No hay partidos registrados</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 btn-primary text-sm"
          >
            Crear primer partido
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {rounds.map((round) => (
            <div key={round}>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                {Number(round) > 0 ? `Jornada ${round}` : 'Sin jornada'}
              </h2>
              <div className="space-y-2">
                {groupedMatches[round].map((match) => {
                  const homeTeam = {
                    name: match.home_team_name,
                    short_name: match.home_team_short_name,
                    shield_url: match.home_team_shield_url,
                  };
                  const awayTeam = {
                    name: match.away_team_name,
                    short_name: match.away_team_short_name,
                    shield_url: match.away_team_shield_url,
                  };
                  const badge = statusBadge[match.status] || statusBadge.scheduled;

                  return (
                    <div key={match.id} className="card p-4">
                      <div className="flex items-center gap-3">
                        {/* Teams */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <TeamShield team={homeTeam} size="sm" />
                          <span className="text-sm font-medium text-gray-900 truncate hidden sm:inline">
                            {homeTeam.name}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate sm:hidden">
                            {homeTeam.short_name || homeTeam.name?.slice(0, 6)}
                          </span>
                        </div>

                        {/* Score / Status */}
                        <div className="text-center flex-shrink-0 px-2">
                          {match.status === 'finished' ? (
                            <p className="font-bold text-lg text-gray-900">
                              {match.home_score} - {match.away_score}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">
                              {formatDatetime(match.scheduled_at)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-sm font-medium text-gray-900 truncate hidden sm:inline">
                            {awayTeam.name}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate sm:hidden">
                            {awayTeam.short_name || awayTeam.name?.slice(0, 6)}
                          </span>
                          <TeamShield team={awayTeam} size="sm" />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-medium ${badge.class}`}>
                            {badge.label}
                          </span>

                          <Link
                            to={`/admin/partidos/${match.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>

                          <button
                            onClick={() => { setEditingMatch(match); setShowModal(true); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDelete(match.id)}
                            disabled={deletingId === match.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <MatchModal
          match={editingMatch}
          teams={teams}
          onClose={() => { setShowModal(false); setEditingMatch(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
