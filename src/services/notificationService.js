import { INITIAL_NOTIFICATIONS } from '../data/mockData';

const NOTIF_STORAGE_KEY = 'labtrack_notifications';

const getInitialData = () => {
  const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_NOTIFICATIONS];
};

let notificationStore = getInitialData();

const persist = () => {
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notificationStore));
  } catch (e) {
    console.error('Failed to persist notifications to localStorage', e);
  }
};

export const notificationService = {
  getAll: async () => {
    return [...notificationStore];
  },

  getForRole: async (role = 'student') => {
    return notificationStore.filter(n => {
      // If notification has specific targetRoles, check inclusion
      if (n.targetRoles && n.targetRoles.length > 0) {
        if (!n.targetRoles.includes(role)) return false;
      }

      // Admin policy: Admin only receives major events (equipment additions, bulk imports, club/event issues, transfers, system alerts)
      if (role === 'admin') {
        const adminAllowedCategories = [
          'equipment_addition',
          'bulk_import',
          'bulk_event_issue',
          'inter_lab_transfer',
          'system'
        ];
        if (n.category && !adminAllowedCategories.includes(n.category)) {
          return false;
        }
      }

      return true;
    });
  },

  markAsRead: async (id) => {
    notificationStore = notificationStore.map(n => n.id === id ? { ...n, read: true } : n);
    persist();
    return [...notificationStore];
  },

  markAllAsRead: async () => {
    notificationStore = notificationStore.map(n => ({ ...n, read: true }));
    persist();
    return [...notificationStore];
  },

  addNotification: async ({ title, message, type = 'info', category = 'system', targetRoles = ['admin', 'assistant', 'faculty', 'student'] }) => {
    const newNotif = {
      id: `NTF-${Date.now()}`,
      title,
      message,
      timestamp: 'Just now',
      type,
      category,
      targetRoles,
      read: false
    };
    notificationStore.unshift(newNotif);
    persist();
    return newNotif;
  }
};
