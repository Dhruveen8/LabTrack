import { INITIAL_USERS } from '../data/mockData';

const AUTH_KEY = 'labtrack_auth_user';

export const authService = {
  login: async (universityIdOrEmail, password, selectedRole) => {
    // Frontend mock authentication simulation
    const user = INITIAL_USERS.find(
      u => u.role === selectedRole || u.email.toLowerCase() === universityIdOrEmail.toLowerCase()
    ) || INITIAL_USERS.find(u => u.role === selectedRole) || INITIAL_USERS[0];

    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return { success: true, user };
  },

  logout: async () => {
    localStorage.removeItem(AUTH_KEY);
    return { success: true };
  },

  getCurrentUser: () => {
    const data = localStorage.getItem(AUTH_KEY);
    if (!data) return INITIAL_USERS[0]; // Default to admin for demo if unset
    try {
      return JSON.parse(data);
    } catch (e) {
      return INITIAL_USERS[0];
    }
  },

  switchRole: (role) => {
    const user = INITIAL_USERS.find(u => u.role === role) || INITIAL_USERS[0];
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  }
};
