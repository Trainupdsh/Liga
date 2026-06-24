import React from 'react';
import { Link } from 'react-router-dom';
import TeamShield from './TeamShield.jsx';

function PlayerAvatar({ player, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-20 h-20 text-2xl',
    xl: 'w-28 h-28 text-4xl',
  };

  if (player.photo_url) {
    return (
      <img
        src={player.photo_url}
        alt={player.name}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '';
          e.target.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-gray-400 to-gray-600
        flex items-center justify-center text-white font-bold flex-shrink-0`}
    >
      {player.name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

export default function PlayerCard({ player, showGoals = false }) {
  const teamData = {
    name: player.team_name,
    shield_url: player.team_shield_url,
  };

  return (
    <Link
      to={`/jugadores/${player.id}`}
      className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow duration-200 cursor-pointer"
    >
      <PlayerAvatar player={player} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{player.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <TeamShield team={teamData} size="xs" />
          <p className="text-sm text-gray-500 truncate">{player.team_name}</p>
        </div>
        {player.jersey_number && (
          <p className="text-xs text-gray-400 mt-0.5">#{player.jersey_number}</p>
        )}
      </div>
      {showGoals && player.goals !== undefined && (
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-blue-600">{player.goals}</p>
          <p className="text-xs text-gray-500">goles</p>
        </div>
      )}
    </Link>
  );
}

export { PlayerAvatar };
