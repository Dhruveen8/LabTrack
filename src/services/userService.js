import { INITIAL_USERS } from '../data/mockData';

const USER_STORAGE_KEY = 'labtrack_users';

const getInitialData = () => {
  const saved = localStorage.getItem(USER_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_USERS];
};

let userStore = getInitialData();

const persist = () => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userStore));
  } catch (e) {
    console.error('Failed to persist users to localStorage', e);
  }
};

export const userService = {
  getAll: async () => {
    return [...userStore];
  },

  getById: async (id) => {
    return userStore.find(user => user.id === id) || null;
  },

  getAssistants: async () => {
    return userStore.filter(u => u.role === 'assistant');
  },

  assignLabsToAssistant: async (userId, labIds = []) => {
    userStore = userStore.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          assignedLabIds: labIds
        };
      }
      return u;
    });
    persist();
    return userStore.find(u => u.id === userId);
  },

  create: async (data) => {
    const newUser = {
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Active',
      assignedLabIds: [],
      ...data
    };
    userStore.push(newUser);
    persist();
    return newUser;
  },

  updateRole: async (id, newRole) => {
    userStore = userStore.map(u => u.id === id ? { ...u, role: newRole } : u);
    persist();
    return userStore.find(u => u.id === id);
  },

  updateStatus: async (id, newStatus) => {
    userStore = userStore.map(u => u.id === id ? { ...u, status: newStatus } : u);
    persist();
    return userStore.find(u => u.id === id);
  }
};
