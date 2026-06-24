import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Tabla', path: '/tabla', icon: '📊' },
  { label: 'Goleadores', path: '/goleadores', icon: '⚽' },
  { label: 'Fixture', path: '/fixture', icon: '📅' },
  { label: 'Resultados', path: '/resultados', icon: '🏆' },
  { label: 'Jugadores', path: '/jugadores', icon: '👤' },
];

export default function Navbar({ leagueName = 'Liga Deportiva' }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/tabla') return location.pathname === '/' || location.pathname === '/tabla';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Desktop/Top Navbar */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="font-bold text-lg text-white hover:text-blue-100 transition-colors">
              {leagueName}
            </Link>

            {/* Desktop tabs */}
            <div className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isActive(tab.path)
                      ? 'bg-white text-blue-700'
                      : 'text-blue-100 hover:bg-blue-600 hover:text-white'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <Link
              to="/admin"
              className="hidden md:block text-xs text-blue-300 hover:text-white transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center py-2 px-1 transition-colors duration-200 ${
                isActive(tab.path)
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-xs mt-0.5 font-medium truncate w-full text-center">
                {tab.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
