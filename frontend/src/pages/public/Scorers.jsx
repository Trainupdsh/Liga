import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';
import { PlayerAvatar } from '../../components/PlayerCard.jsx';

const medalColors = ['text-yellow-500', 'text-gray-400', 'text-orange-500'];

export default function Scorers() {
  const [scorers, setScorers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicApi
      .getScorers()
      .then((res) => setScorers(res.data))
      .catch((err) => {
        console.error(err);
        setError('No se pudo cargar la tabla de goleadores');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Tabla de Goleadores</h1>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="w-14 h-14 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-36" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tabla de Goleadores</h1>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      {!error && scorers.length === 0 && (
        <div className="card p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">⚽</p>
          <p>No hay goles registrados aún</p>
        </div>
      )}

      <div className="space-y-2">
        {scorers.map((scorer, index) => {
          const teamData = {
            name: scorer.team_name,
            shield_url: scorer.team_shield_url,
          };
          const player = {
            name: scorer.name,
            photo_url: scorer.photo_url,
          };

          return (
            <Link
              key={scorer.id}
              to={`/jugadores/${scorer.id}`}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow duration-200"
            >
              {/* Position */}
              <div className="w-8 text-center flex-shrink-0">
                {index < 3 ? (
                  <span className={`text-2xl ${medalColors[index]}`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                ) : (
                  <span className="text-gray-500 font-bold text-sm">{index + 1}</span>
                )}
              </div>

              {/* Player photo */}
              <PlayerAvatar player={player} size="md" />

              {/* Name and team */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{scorer.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <TeamShield team={teamData} size="xs" />
                  <p className="text-sm text-gray-500 truncate">{scorer.team_name}</p>
                </div>
              </div>

              {/* Goals */}
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-blue-600">{scorer.goals}</p>
                <p className="text-xs text-gray-500">{scorer.goals === '1' ? 'gol' : 'goles'}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
