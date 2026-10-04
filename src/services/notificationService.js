import apiClient from '../api/client';

export const notificationService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/notifications/');
      return response.data;
    } catch (e) {
      console.error('Error fetching notifications', e);
      return [];
    }
  },

  getForRole: async (role = 'student') => {
    // The backend now filters by current_user.id, so we just get all for this user
    return await notificationService.getAll();
  },

  markAsRead: async (id) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      return await notificationService.getAll();
    } catch (e) {
      console.error('Error marking notification read', e);
      return [];
    }
  },

  markAllAsRead: async () => {
    try {
      await apiClient.post('/notifications/mark-all-read');
      return await notificationService.getAll();
    } catch (e) {
      console.error('Error marking all notifications read', e);
      return [];
    }
  },

  getUnreadCount: async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      return response.data.unreadCount;
    } catch (e) {
      return 0;
    }
  },

  addNotification: async (data) => {
    console.warn('Frontend should not manually add notifications anymore. Backend handles it.');
    return null;
  }
};
