import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';
import { PlayerAvatar } from '../../components/PlayerCard.jsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function StatCard({ label, value, color = 'text-blue-600' }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function PlayerProfile() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicApi
      .getPlayer(id)
      .then((res) => setPlayer(res.data))
      .catch((err) => {
        console.error(err);
        if (err.response?.status === 404) {
          setError('Jugador no encontrado');
        } else {
          setError('Error al cargar el perfil del jugador');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-48" />
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">😕</p>
          <p className="text-gray-700 font-semibold">{error}</p>
          <Link to="/jugadores" className="mt-4 inline-block btn-primary text-sm">
            Volver a búsqueda
          </Link>
        </div>
      </div>
    );
  }

  if (!player) return null;

  const teamData = {
    name: player.team_name,
    shield_url: player.team_shield_url,
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Back button */}
      <Link
        to="/jugadores"
        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </Link>

      {/* Player card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <PlayerAvatar player={player} size="xl" />

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{player.name}</h1>

            {player.jersey_number && (
              <p className="text-blue-600 font-semibold mt-1">#{player.jersey_number}</p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <TeamShield team={teamData} size="md" />
              <div>
                <p className="font-semibold text-gray-800">{player.team_name}</p>
                <p className="text-sm text-gray-500">{player.team_short_name}</p>
              </div>
            </div>

            {!player.active && (
              <span className="inline-block mt-3 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                Inactivo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <h2 className="text-lg font-bold text-gray-700 mb-3">Estadísticas de temporada</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Goles" value={player.stats?.total_goals || 0} color="text-blue-600" />
        <StatCard
          label="Partidos goleados"
          value={player.stats?.matches_scored || 0}
          color="text-green-600"
        />
      </div>

      {/* Recent goals */}
      {player.recent_goals && player.recent_goals.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-700 mb-3">Últimos partidos con gol</h2>
          <div className="space-y-2">
            {player.recent_goals.map((goal) => (
              <div key={goal.match_id} className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {goal.home_team_name} {goal.home_score} - {goal.away_score} {goal.away_team_name}
                    </p>
                    {goal.round && (
                      <p className="text-xs text-gray-500">Jornada {goal.round}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                    <span>⚽</span>
                    {Number(goal.value) > 1 && <span>x{goal.value}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
