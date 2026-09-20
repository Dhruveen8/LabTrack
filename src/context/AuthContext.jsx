import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

// Normalize backend user data (role comes as ADMIN, ASSISTANT, etc.)
const normalizeUser = (userData) => {
  if (!userData) return null;
  return {
    ...userData,
    role: userData.role ? userData.role.toLowerCase() : userData.role,
    assignedLabIds: userData.assigned_labs || userData.assignedLabIds || [],
    departmentId: userData.department_id || userData.departmentId || null,
    universityId: userData.id
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(normalizeUser(currentUser));
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
    
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password, role) => {
    try {
      const res = await authService.login(email, password);
      if (res.success) {
        setUser(normalizeUser(res.user));
      }
      return res;
    } catch (error) {
      console.error('Login error', error);
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const switchDemoRole = async (role) => {
    // Demo only: The backend doesn't support switching roles without relogging,
    // so this is a placeholder or we can implement auto-login with predefined demo users.
    console.warn("Role switching is mocked in UI, login directly as role instead.");
    return user;
  };

  const refreshUser = async () => {
    const current = await authService.getCurrentUser();
    setUser(normalizeUser(current));
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, switchDemoRole, refreshUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
