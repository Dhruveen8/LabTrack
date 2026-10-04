import apiClient from '../api/client';

const DEFAULT_SETTINGS = {
  studentBorrowLimitDays: '14',
  facultyBorrowLimitDays: '30',
  emailOverdueAlerts: 'true',
  transferAlerts: 'true',
  allowSelfRenewal: 'true'
};

export const settingsService = {
  get: async () => {
    try {
      const response = await apiClient.get('/settings/');
      const backendSettings = response.data.settings;
      
      // Merge with defaults for any missing keys
      return { ...DEFAULT_SETTINGS, ...backendSettings };
    } catch (e) {
      console.error('Error fetching settings', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  update: async (newSettings) => {
    try {
      // Convert boolean values to strings for generic key-value storage
      const stringifiedSettings = {};
      for (const [key, value] of Object.entries(newSettings)) {
        stringifiedSettings[key] = String(value);
      }
      
      await apiClient.put('/settings/', stringifiedSettings);
      return await settingsService.get();
    } catch (e) {
      throw e;
    }
  }
};
