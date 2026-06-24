import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';

export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('liga_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('liga_token'));
  const [loading, setLoading] = useState(false);

  const isAuthenticated = Boolean(token && user);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const res = await adminApi.login(email, password);
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem('liga_token', newToken);
      localStorage.setItem('liga_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('liga_token');
    localStorage.removeItem('liga_user');
    setToken(null);
    setUser(null);
  }, []);

  // Verify token validity on mount
  useEffect(() => {
    if (token && !user) {
      adminApi
        .getMe()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('liga_user', JSON.stringify(res.data));
        })
        .catch(() => {
          logout();
        });
    }
  }, [token, user, logout]);

  return { user, token, isAuthenticated, loading, login, logout };
}
