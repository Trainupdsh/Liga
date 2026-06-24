import React, { useEffect, useState, useRef } from 'react';
import { adminApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';

function TeamModal({ team, onClose, onSave }) {
  const [name, setName] = useState(team?.name || '');
  const [shortName, setShortName] = useState(team?.short_name || '');
  const [shieldFile, setShieldFile] = useState(null);
  const [shieldPreview, setShieldPreview] = useState(team?.shield_url || null);
  const [removeShield, setRemoveShield] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setShieldFile(file);
    setShieldPreview(URL.createObjectURL(file));
    setRemoveShield(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del equipo es obligatorio');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('short_name', shortName.trim().toUpperCase());
      if (shieldFile) formData.append('shield', shieldFile);
      if (removeShield) formData.append('remove_shield', 'true');

      let result;
      if (team) {
        result = await adminApi.updateTeam(team.id, formData);
      } else {
        result = await adminApi.createTeam(formData);
      }

      onSave(result.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el equipo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {team ? 'Editar equipo' : 'Nuevo equipo'}
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

          {/* Shield */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Escudo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                {shieldPreview && !removeShield ? (
                  <img src={shieldPreview} alt="Escudo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl">🛡️</span>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary text-xs py-1.5"
                >
                  Subir imagen
                </button>
                {shieldPreview && !removeShield && (
                  <button
                    type="button"
                    className="block text-xs text-red-500 hover:text-red-700"
                    onClick={() => {
                      setShieldFile(null);
                      setShieldPreview(null);
                      setRemoveShield(true);
                    }}
                  >
                    Quitar imagen
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del equipo *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Ej: Deportivo San Martín"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre corto (máx. 4 letras)
            </label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 4))}
              className="input-field uppercase"
              placeholder="DSM"
              maxLength={4}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary">
              {saving ? 'Guardando...' : team ? 'Guardar cambios' : 'Crear equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadTeams = () => {
    setLoading(true);
    adminApi
      .getTeams()
      .then((res) => setTeams(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Error al cargar equipos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleSave = (savedTeam) => {
    if (editingTeam) {
      setTeams((prev) => prev.map((t) => (t.id === savedTeam.id ? savedTeam : t)));
    } else {
      setTeams((prev) => [...prev, savedTeam]);
    }
    setShowModal(false);
    setEditingTeam(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que querés eliminar este equipo?')) return;
    setDeletingId(id);
    try {
      await adminApi.deleteTeam(id);
      setTeams((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el equipo');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipos</h1>
          <p className="text-gray-500 text-sm mt-1">{teams.length} equipo{teams.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditingTeam(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo equipo
        </button>
      </div>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      {/* Teams list */}
      {loading ? (
        <div className="card divide-y divide-gray-100">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-48" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">🛡️</p>
          <p>No hay equipos registrados</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 btn-primary text-sm"
          >
            Agregar primer equipo
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {teams.map((team) => (
            <div key={team.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
              <TeamShield team={team} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{team.name}</p>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {team.short_name && <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{team.short_name}</span>}
                  <span>{team.player_count} jugador{team.player_count !== '1' ? 'es' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingTeam(team); setShowModal(true); }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(team.id)}
                  disabled={deletingId === team.id}
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
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <TeamModal
          team={editingTeam}
          onClose={() => { setShowModal(false); setEditingTeam(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
