import apiClient from '../api/client';

export const departmentService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/departments/');
      return response.data;
    } catch (e) {
      console.error('Error fetching departments', e);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const response = await apiClient.get(`/departments/${id}`);
      return response.data;
    } catch {
      return null;
    }
  },

  create: async (data) => {
    const payload = {
      name: data.name,
      code: data.code,
      hod_name: data.hodName || data.hod_name || "TBD"
    };
    const response = await apiClient.post('/departments/', payload);
    return response.data;
  }
};
