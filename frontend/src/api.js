import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('liga_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear local storage
      localStorage.removeItem('liga_token');
      localStorage.removeItem('liga_user');
      // Redirect to login if in admin area
      if (window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// Public API helpers
export const publicApi = {
  getLeague: () => api.get('/public/league'),
  getStandings: () => api.get('/public/standings'),
  getScorers: () => api.get('/public/scorers'),
  getFixtures: () => api.get('/public/fixtures'),
  getResults: () => api.get('/public/results'),
  searchPlayers: (q) => api.get('/public/players/search', { params: { q } }),
  getPlayer: (id) => api.get(`/public/players/${id}`),
};

// Admin API helpers
export const adminApi = {
  login: (email, password) => api.post('/admin/auth/login', { email, password }),
  getMe: () => api.get('/admin/me'),
  getDashboard: () => api.get('/admin/dashboard'),

  // Teams
  getTeams: () => api.get('/admin/teams'),
  createTeam: (formData) =>
    api.post('/admin/teams', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateTeam: (id, formData) =>
    api.put(`/admin/teams/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteTeam: (id) => api.delete(`/admin/teams/${id}`),

  // Players
  getPlayers: (teamId) => api.get('/admin/players', { params: teamId ? { team_id: teamId } : {} }),
  createPlayer: (formData) =>
    api.post('/admin/players', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updatePlayer: (id, formData) =>
    api.put(`/admin/players/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deletePlayer: (id) => api.delete(`/admin/players/${id}`),

  // Matches
  getMatches: () => api.get('/admin/matches'),
  createMatch: (data) => api.post('/admin/matches', data),
  updateMatch: (id, data) => api.put(`/admin/matches/${id}`, data),
  deleteMatch: (id) => api.delete(`/admin/matches/${id}`),
  setResult: (id, data) => api.post(`/admin/matches/${id}/result`, data),
  getMatchEvents: (id) => api.get(`/admin/matches/${id}/events`),
  addMatchEvent: (id, data) => api.post(`/admin/matches/${id}/events`, data),
  deleteMatchEvent: (matchId, eventId) => api.delete(`/admin/matches/${matchId}/events/${eventId}`),

  // Upload
  uploadImage: (file, folder) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);
    return api.post('/admin/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export default api;
