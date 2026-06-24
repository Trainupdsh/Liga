import React, { useEffect, useState } from 'react';
import { publicApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';

function LoadingRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(11)].map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

const positionBg = (pos) => {
  if (pos === 1) return 'bg-yellow-50';
  if (pos === 2) return 'bg-gray-50';
  if (pos === 3) return 'bg-orange-50';
  return '';
};

const positionBadge = (pos) => {
  if (pos === 1) return 'bg-yellow-400 text-yellow-900';
  if (pos === 2) return 'bg-gray-400 text-white';
  if (pos === 3) return 'bg-orange-400 text-white';
  return 'bg-gray-100 text-gray-600';
};

export default function Standings() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicApi
      .getStandings()
      .then((res) => setStandings(res.data))
      .catch((err) => {
        console.error(err);
        setError('No se pudo cargar la tabla de posiciones');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tabla de Posiciones</h1>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-3 text-left w-10">Pos</th>
                <th className="px-3 py-3 text-left">Equipo</th>
                <th className="px-3 py-3 text-center w-10" title="Partidos jugados">PJ</th>
                <th className="px-3 py-3 text-center w-10 hidden sm:table-cell" title="Ganados">PG</th>
                <th className="px-3 py-3 text-center w-10 hidden sm:table-cell" title="Empatados">PE</th>
                <th className="px-3 py-3 text-center w-10 hidden sm:table-cell" title="Perdidos">PP</th>
                <th className="px-3 py-3 text-center w-10 hidden md:table-cell" title="Goles a favor">GF</th>
                <th className="px-3 py-3 text-center w-10 hidden md:table-cell" title="Goles en contra">GC</th>
                <th className="px-3 py-3 text-center w-12" title="Diferencia de goles">DIF</th>
                <th className="px-3 py-3 text-center w-12 font-bold text-blue-700" title="Puntos">PTS</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(6)].map((_, i) => <LoadingRow key={i} />)}
              {!loading && standings.length === 0 && !error && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    No hay equipos registrados aún
                  </td>
                </tr>
              )}
              {standings.map((team) => (
                <tr
                  key={team.team_id}
                  className={`table-row ${positionBg(team.pos)}`}
                >
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${positionBadge(team.pos)}`}
                    >
                      {team.pos}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <TeamShield
                        team={{ name: team.name, shield_url: team.shield_url }}
                        size="sm"
                      />
                      <div>
                        <span className="hidden sm:inline font-medium text-gray-900">{team.name}</span>
                        <span className="sm:hidden font-medium text-gray-900">
                          {team.short_name || team.name.substring(0, 8)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">{team.pj}</td>
                  <td className="px-3 py-3 text-center text-green-700 hidden sm:table-cell">{team.pg}</td>
                  <td className="px-3 py-3 text-center text-yellow-700 hidden sm:table-cell">{team.pe}</td>
                  <td className="px-3 py-3 text-center text-red-700 hidden sm:table-cell">{team.pp}</td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">{team.gf}</td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">{team.gc}</td>
                  <td className={`px-3 py-3 text-center font-medium ${team.dif > 0 ? 'text-green-600' : team.dif < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {team.dif > 0 ? `+${team.dif}` : team.dif}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-blue-700">{team.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile legend */}
        <div className="px-4 py-3 border-t border-gray-100 sm:hidden">
          <p className="text-xs text-gray-500">
            PJ: Partidos Jugados · DIF: Diferencia · PTS: Puntos
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Desliza la tabla para ver más columnas
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> 1° lugar
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> 2° lugar
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> 3° lugar
        </span>
      </div>
    </div>
  );
}
