import React from 'react';

function PlaceholderShield({ name, size = 'md' }) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-xl',
    xl: 'w-20 h-20 text-2xl',
  };

  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '?';

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-blue-700
        flex items-center justify-center text-white font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  );
}

export default function TeamShield({ team, size = 'md', className = '' }) {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  if (!team) return null;

  if (!team.shield_url) {
    return <PlaceholderShield name={team.name || team.team_name} size={size} />;
  }

  return (
    <img
      src={team.shield_url}
      alt={`Escudo de ${team.name || team.team_name}`}
      className={`${sizeClasses[size]} object-contain flex-shrink-0 ${className}`}
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
      }}
    />
  );
}

export { PlaceholderShield };
