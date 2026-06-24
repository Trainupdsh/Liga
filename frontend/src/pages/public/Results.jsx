import React, { useEffect, useState } from 'react';
import { publicApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), "d MMM yyyy", { locale: es });
  } catch {
    return dateStr;
  }
}

function MatchResult({ match }) {
  const [expanded, setExpanded] = useState(false);

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

  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;
  const isDraw = match.home_score === match.away_score;

  const homeScorers = (match.scorers || []).filter((s) => s.team_id === match.home_team_id);
  const awayScorers = (match.scorers || []).filter((s) => s.team_id === match.away_team_id);

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full p-4 text-left hover:bg-gray-50 transition-colors duration-150"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Home team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamShield team={homeTeam} size="sm" />
            <span
              className={`text-sm font-semibold truncate ${homeWon ? 'text-gray-900' : 'text-gray-500'}`}
            >
              <span className="hidden sm:inline">{homeTeam.name}</span>
              <span className="sm:hidden">{homeTeam.short_name || homeTeam.name?.substring(0, 6)}</span>
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-1 flex-shrink-0 px-3">
            <span className={`text-xl font-bold ${homeWon ? 'text-gray-900' : 'text-gray-400'}`}>
              {match.home_score}
            </span>
            <span className="text-gray-400 font-semibold text-sm mx-1">-</span>
            <span className={`text-xl font-bold ${awayWon ? 'text-gray-900' : 'text-gray-400'}`}>
              {match.away_score}
            </span>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span
              className={`text-sm font-semibold truncate text-right ${awayWon ? 'text-gray-900' : 'text-gray-500'}`}
            >
              <span className="hidden sm:inline">{awayTeam.name}</span>
              <span className="sm:hidden">{awayTeam.short_name || awayTeam.name?.substring(0, 6)}</span>
            </span>
            <TeamShield team={awayTeam} size="sm" />
          </div>

          {/* Expand icon */}
          {match.scorers?.length > 0 && (
            <svg
              className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          {match.round && <span>Jornada {match.round}</span>}
          {match.played_at && <span>{formatDate(match.played_at)}</span>}
          {match.venue && <span>· {match.venue}</span>}
          {match.scorers?.length > 0 && (
            <span className="text-blue-500">
              {expanded ? 'Ocultar goleadores' : 'Ver goleadores'}
            </span>
          )}
        </div>
      </button>

      {/* Scorers expanded */}
      {expanded && match.scorers?.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-2 gap-3 bg-gray-50">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {homeTeam.short_name || homeTeam.name}
            </p>
            {homeScorers.length === 0 ? (
              <p className="text-xs text-gray-400">-</p>
            ) : (
              <ul className="space-y-1">
                {homeScorers.map((s) => (
                  <li key={s.player_id + s.match_id} className="text-xs text-gray-700 flex items-center gap-1">
                    <span>⚽</span> {s.player_name}
                    {s.value > 1 && <span className="text-gray-400">x{s.value}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {awayTeam.short_name || awayTeam.name}
            </p>
            {awayScorers.length === 0 ? (
              <p className="text-xs text-gray-400">-</p>
            ) : (
              <ul className="space-y-1">
                {awayScorers.map((s) => (
                  <li key={s.player_id + s.match_id} className="text-xs text-gray-700 flex items-center gap-1">
                    <span>⚽</span> {s.player_name}
                    {s.value > 1 && <span className="text-gray-400">x{s.value}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicApi
      .getResults()
      .then((res) => setResults(res.data))
      .catch((err) => {
        console.error(err);
        setError('No se pudo cargar los resultados');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Últimos Resultados</h1>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="card p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">🏆</p>
          <p>No hay resultados registrados aún</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((match) => (
          <MatchResult key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
}
