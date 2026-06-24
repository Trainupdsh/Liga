import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api.js';
import { useAuth } from '../../hooks/useAuth.js';

function StatCard({ label, value, icon, color, to }) {
  const content = (
    <div className={`card p-6 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>
            {value === undefined ? (
              <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse" />
            ) : (
              value
            )}
          </p>
        </div>
        <span className="text-3xl opacity-80">{icon}</span>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return content;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi
      .getDashboard()
      .then((res) => setStats(res.data))
      .catch((err) => {
        console.error(err);
        setError('No se pudo cargar el dashboard');
      });
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {user && (
          <p className="text-gray-500 mt-1">Bienvenido, {user.name}</p>
        )}
      </div>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-6">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Equipos"
          value={stats?.teams}
          icon="🛡️"
          color="text-blue-600"
          to="/admin/equipos"
        />
        <StatCard
          label="Jugadores"
          value={stats?.players}
          icon="👥"
          color="text-green-600"
          to="/admin/jugadores"
        />
        <StatCard
          label="Partidos jugados"
          value={stats?.matches_played}
          icon="✅"
          color="text-purple-600"
          to="/admin/partidos"
        />
        <StatCard
          label="Partidos pendientes"
          value={stats?.matches_pending}
          icon="📅"
          color="text-orange-600"
          to="/admin/partidos"
        />
      </div>

      {/* Quick actions */}
      <h2 className="text-lg font-bold text-gray-700 mb-4">Acciones rápidas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/admin/partidos"
          className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">⚽</span>
          <div>
            <p className="font-semibold text-gray-900">Cargar resultado</p>
            <p className="text-sm text-gray-500">Actualizar score de un partido</p>
          </div>
        </Link>
        <Link
          to="/admin/equipos"
          className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">🛡️</span>
          <div>
            <p className="font-semibold text-gray-900">Nuevo equipo</p>
            <p className="text-sm text-gray-500">Agregar equipo a la liga</p>
          </div>
        </Link>
        <Link
          to="/admin/jugadores"
          className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">👤</span>
          <div>
            <p className="font-semibold text-gray-900">Nuevo jugador</p>
            <p className="text-sm text-gray-500">Agregar jugador a un equipo</p>
          </div>
        </Link>
      </div>

      {/* Link to public site */}
      <div className="mt-8 card p-4 flex items-center justify-between bg-blue-50 border-blue-200">
        <div>
          <p className="font-medium text-blue-900">Ver sitio público</p>
          <p className="text-sm text-blue-600">Tabla, goleadores, fixture y resultados</p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-sm"
        >
          Abrir
        </a>
      </div>
    </div>
  );
}
