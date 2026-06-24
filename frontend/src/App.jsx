import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Public pages
import Home from './pages/public/Home.jsx';
import Standings from './pages/public/Standings.jsx';
import Scorers from './pages/public/Scorers.jsx';
import Fixture from './pages/public/Fixture.jsx';
import Results from './pages/public/Results.jsx';
import PlayerSearch from './pages/public/PlayerSearch.jsx';
import PlayerProfile from './pages/public/PlayerProfile.jsx';

// Admin pages
import Login from './pages/admin/Login.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Teams from './pages/admin/Teams.jsx';
import Players from './pages/admin/Players.jsx';
import Matches from './pages/admin/Matches.jsx';
import MatchDetail from './pages/admin/MatchDetail.jsx';

// Components
import Navbar from './components/Navbar.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Hooks
import { useAuth } from './hooks/useAuth.js';

// Public layout with navbar
function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      {/* pb-16 on mobile for bottom tab bar */}
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}

// Auth context provider wrapper
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <PublicLayout>
            <Home />
          </PublicLayout>
        }
      />
      <Route
        path="/tabla"
        element={
          <PublicLayout>
            <Standings />
          </PublicLayout>
        }
      />
      <Route
        path="/goleadores"
        element={
          <PublicLayout>
            <Scorers />
          </PublicLayout>
        }
      />
      <Route
        path="/fixture"
        element={
          <PublicLayout>
            <Fixture />
          </PublicLayout>
        }
      />
      <Route
        path="/resultados"
        element={
          <PublicLayout>
            <Results />
          </PublicLayout>
        }
      />
      <Route
        path="/jugadores"
        element={
          <PublicLayout>
            <PlayerSearch />
          </PublicLayout>
        }
      />
      <Route
        path="/jugadores/:id"
        element={
          <PublicLayout>
            <PlayerProfile />
          </PublicLayout>
        }
      />

      {/* Admin routes */}
      <Route path="/admin/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/equipos"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Teams />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/jugadores"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Players />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/partidos"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Matches />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/partidos/:id"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <MatchDetail />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
