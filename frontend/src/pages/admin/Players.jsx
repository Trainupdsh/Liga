import React, { useEffect, useState, useRef } from 'react';
import { adminApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';
import { PlayerAvatar } from '../../components/PlayerCard.jsx';

function PlayerModal({ player, teams, onClose, onSave }) {
  const [name, setName] = useState(player?.name || '');
  const [teamId, setTeamId] = useState(player?.team_id || (teams[0]?.id || ''));
  const [jerseyNumber, setJerseyNumber] = useState(player?.jersey_number || '');
  const [active, setActive] = useState(player?.active !== false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(player?.photo_url || null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del jugador es obligatorio');
      return;
    }
    if (!teamId) {
      setError('Debés seleccionar un equipo');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('team_id', teamId);
      formData.append('jersey_number', jerseyNumber || '');
      formData.append('active', active ? 'true' : 'false');
      if (photoFile) formData.append('photo', photoFile);
      if (removePhoto) formData.append('remove_photo', 'true');

      let result;
      if (player) {
        result = await adminApi.updatePlayer(player.id, formData);
      } else {
        result = await adminApi.createPlayer(formData);
      }

      onSave(result.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el jugador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-screen overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">
            {player ? 'Editar jugador' : 'Nuevo jugador'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
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

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foto</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                {photoPreview && !removePhoto ? (
                  <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary text-xs py-1.5"
                >
                  Subir foto
                </button>
                {photoPreview && !removePhoto && (
                  <button
                    type="button"
                    className="block text-xs text-red-500 hover:text-red-700"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      setRemovePhoto(true);
                    }}
                  >
                    Quitar foto
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Nombre y apellido"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipo *</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Seleccionar equipo</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de camiseta</label>
            <input
              type="number"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              className="input-field"
              placeholder="Ej: 10"
              min={1}
              max={99}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              Jugador activo
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary">
              {saving ? 'Guardando...' : player ? 'Guardar cambios' : 'Crear jugador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [filterTeam, setFilterTeam] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [playersRes, teamsRes] = await Promise.all([
        adminApi.getPlayers(filterTeam || undefined),
        adminApi.getTeams(),
      ]);
      setPlayers(playersRes.data);
      setTeams(teamsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterTeam]);

  const handleSave = (savedPlayer) => {
    if (editingPlayer) {
      setPlayers((prev) => prev.map((p) => (p.id === savedPlayer.id ? savedPlayer : p)));
    } else {
      setPlayers((prev) => [...prev, savedPlayer]);
    }
    setShowModal(false);
    setEditingPlayer(null);
    // Reload to get full joined data
    adminApi.getPlayers(filterTeam || undefined).then((res) => setPlayers(res.data));
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que querés eliminar este jugador?')) return;
    setDeletingId(id);
    try {
      await adminApi.deletePlayer(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el jugador');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jugadores</h1>
          <p className="text-gray-500 text-sm mt-1">{players.length} jugador{players.length !== 1 ? 'es' : ''}</p>
        </div>
        <button
          onClick={() => { setEditingPlayer(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo jugador
        </button>
      </div>

      {/* Filter by team */}
      <div className="mb-4">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="input-field max-w-xs"
        >
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      {/* Players list */}
      {loading ? (
        <div className="card divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-36" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">👥</p>
          <p>No hay jugadores registrados</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 btn-primary text-sm"
          >
            Agregar primer jugador
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {players.map((player) => {
            const playerForAvatar = { name: player.name, photo_url: player.photo_url };
            const teamForShield = { name: player.team_name, shield_url: player.team_shield_url };

            return (
              <div key={player.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                <PlayerAvatar player={playerForAvatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{player.name}</p>
                    {player.jersey_number && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        #{player.jersey_number}
                      </span>
                    )}
                    {!player.active && (
                      <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <TeamShield team={teamForShield} size="xs" />
                    <p className="text-sm text-gray-500 truncate">{player.team_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingPlayer(player); setShowModal(true); }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(player.id)}
                    disabled={deletingId === player.id}
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
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PlayerModal
          player={editingPlayer}
          teams={teams}
          onClose={() => { setShowModal(false); setEditingPlayer(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
