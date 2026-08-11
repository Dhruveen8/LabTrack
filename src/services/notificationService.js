import { INITIAL_NOTIFICATIONS } from '../data/mockData';

let notificationStore = [...INITIAL_NOTIFICATIONS];

export const notificationService = {
  getAll: async () => {
    return [...notificationStore];
  },

  markAsRead: async (id) => {
    notificationStore = notificationStore.map(n => n.id === id ? { ...n, read: true } : n);
    return [...notificationStore];
  },

  markAllAsRead: async () => {
    notificationStore = notificationStore.map(n => ({ ...n, read: true }));
    return [...notificationStore];
  },

  addNotification: async (title, message, type = 'info') => {
    const newNotif = {
      id: `NTF-${Date.now()}`,
      title,
      message,
      timestamp: 'Just now',
      type,
      read: false
    };
    notificationStore.unshift(newNotif);
    return newNotif;
  }
};
