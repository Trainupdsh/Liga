import React, { useEffect, useState } from 'react';
import { publicApi } from '../../api.js';
import TeamShield from '../../components/TeamShield.jsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function formatDate(dateStr) {
  if (!dateStr) return 'Fecha a confirmar';
  try {
    return format(parseISO(dateStr), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'HH:mm');
  } catch {
    return '';
  }
}

function MatchCard({ match }) {
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

  const time = formatTime(match.scheduled_at);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <div className="flex flex-col items-center gap-2 flex-1 text-center">
          <TeamShield team={homeTeam} size="lg" />
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            <span className="hidden sm:inline">{homeTeam.name}</span>
            <span className="sm:hidden">{homeTeam.short_name || homeTeam.name?.substring(0, 6)}</span>
          </p>
        </div>

        {/* VS / Time */}
        <div className="flex flex-col items-center gap-1 px-2">
          {time && (
            <p className="text-lg font-bold text-blue-600">{time}</p>
          )}
          <p className="text-gray-400 font-semibold text-sm">VS</p>
        </div>

        {/* Away team */}
        <div className="flex flex-col items-center gap-2 flex-1 text-center">
          <TeamShield team={awayTeam} size="lg" />
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            <span className="hidden sm:inline">{awayTeam.name}</span>
            <span className="sm:hidden">{awayTeam.short_name || awayTeam.name?.substring(0, 6)}</span>
          </p>
        </div>
      </div>

      {match.venue && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-gray-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {match.venue}
        </div>
      )}
    </div>
  );
}

export default function Fixture() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicApi
      .getFixtures()
      .then((res) => setFixtures(res.data))
      .catch((err) => {
        console.error(err);
        setError('No se pudo cargar el fixture');
      })
      .finally(() => setLoading(false));
  }, []);

  // Group by round
  const groupedByRound = fixtures.reduce((acc, match) => {
    const round = match.round || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});

  const rounds = Object.keys(groupedByRound).sort((a, b) => Number(a) - Number(b));

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Fixture</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="card p-4 h-28 animate-pulse bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Fixture — Próximos Partidos</h1>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      {!error && fixtures.length === 0 && (
        <div className="card p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">📅</p>
          <p>No hay partidos programados</p>
        </div>
      )}

      <div className="space-y-6">
        {rounds.map((round) => {
          const matches = groupedByRound[round];
          const firstMatch = matches[0];
          const dateLabel = firstMatch.scheduled_at
            ? formatDate(firstMatch.scheduled_at)
            : null;

          return (
            <div key={round}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-bold text-gray-700">
                  {Number(round) > 0 ? `Jornada ${round}` : 'Sin jornada asignada'}
                </h2>
                {dateLabel && (
                  <span className="text-sm text-gray-500 capitalize">{dateLabel}</span>
                )}
              </div>
              <div className="space-y-3">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
