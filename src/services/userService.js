import { INITIAL_USERS } from '../data/mockData';

let userStore = [...INITIAL_USERS];

export const userService = {
  getAll: async () => {
    return [...userStore];
  },

  getById: async (id) => {
    return userStore.find(user => user.id === id) || null;
  },

  updateRole: async (id, newRole) => {
    userStore = userStore.map(u => u.id === id ? { ...u, role: newRole } : u);
    return userStore.find(u => u.id === id);
  },

  updateStatus: async (id, newStatus) => {
    userStore = userStore.map(u => u.id === id ? { ...u, status: newStatus } : u);
    return userStore.find(u => u.id === id);
  }
};
