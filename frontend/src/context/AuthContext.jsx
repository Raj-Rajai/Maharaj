import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (error) {
          if (error.response?.status === 401) {
            localStorage.clear();
          }
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      setUser(res.data.user);
      return res.data.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      localStorage.clear();
      setUser(null);
      window.location.href = '/login';
    }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isAcMaster = user?.role === 'AC_MASTER';
  const isNonAcMaster = user?.role === 'NON_AC_MASTER';

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return user.permissions?.includes(permission) || false;
  }, [user]);

  const hasAnyPermission = useCallback((...permissions) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return permissions.some(p => user.permissions?.includes(p)) || false;
  }, [user]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      return res.data;
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.clear();
        setUser(null);
        window.location.href = '/login';
      }
      return null;
    }
  }, []);

  useEffect(() => {
    let lastRefreshTime = 0;
    const onFocus = () => {
      const token = localStorage.getItem('accessToken');
      const now = Date.now();
      // Throttle window focus refresh: at most once every 30 seconds
      if (token && now - lastRefreshTime > 30000) {
        lastRefreshTime = now;
        refreshUser();
      }
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        refreshUser();
      }
    }, 45000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      refreshUser,
      isSuperAdmin,
      isAdmin,
      isAcMaster,
      isNonAcMaster,
      hasPermission,
      hasAnyPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};
