import React, { useState, useEffect, useCallback, useRef } from 'react';
import { publicApi } from '../../api.js';
import PlayerCard from '../../components/PlayerCard.jsx';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function PlayerSearch() {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setPlayers([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    publicApi
      .searchPlayers(debouncedQuery)
      .then((res) => {
        setPlayers(res.data);
        setSearched(true);
      })
      .catch((err) => {
        console.error(err);
        setError('Error al buscar jugadores');
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Buscar Jugadores</h1>

      {/* Search input */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {loading ? (
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por nombre del jugador..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-base
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            bg-white shadow-sm"
        />
        {query && (
          <button
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
            onClick={() => setQuery('')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Hint */}
      {query.length === 1 && (
        <p className="text-sm text-gray-500 mb-4">Escribe al menos 2 caracteres para buscar</p>
      )}

      {/* Error */}
      {error && (
        <div className="card p-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      {/* Results */}
      {searched && !loading && players.length === 0 && (
        <div className="card p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">👤</p>
          <p>No se encontraron jugadores con ese nombre</p>
          <p className="text-sm text-gray-400 mt-2">Intentá con otro nombre</p>
        </div>
      )}

      {/* Initial state */}
      {!query && (
        <div className="card p-10 text-center text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500">Ingresá el nombre de un jugador para buscarlo</p>
        </div>
      )}

      <div className="space-y-3">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>

      {players.length > 0 && (
        <p className="text-center text-sm text-gray-400 mt-4">
          {players.length} resultado{players.length !== 1 ? 's' : ''}
          {players.length === 20 && ' (mostrando los primeros 20)'}
        </p>
      )}
    </div>
  );
}
