import apiClient from '../api/client';

export const labService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/labs/');
      return response.data;
    } catch (e) {
      console.error('Error fetching labs', e);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const labs = await labService.getAll();
      return labs.find(lab => lab.id === parseInt(id) || lab.id === id) || null;
    } catch (e) {
      return null;
    }
  },

  getByDepartment: async (deptId) => {
    try {
      const labs = await labService.getAll();
      return labs.filter(lab => lab.department_id === parseInt(deptId) || lab.department_id === deptId);
    } catch (e) {
      return [];
    }
  },

  getByAssistant: async (userId) => {
    try {
      const labs = await labService.getAll();
      return labs.filter(lab => lab.incharge_user_id === parseInt(userId) || lab.incharge_user_id === userId);
    } catch (e) {
      return [];
    }
  },

  create: async (data) => {
    const payload = {
      name: data.name,
      code: data.code,
      department_id: data.departmentId || data.department_id,
      incharge_user_id: data.inchargeUserId || data.incharge_user_id || null,
      total_capacity: data.totalCapacity || 30
    };
    try {
      const response = await apiClient.post('/labs/', payload);
      return response.data;
    } catch (e) {
      throw e;
    }
  },

  update: async (id, data) => {
    try {
      const response = await apiClient.put(`/labs/${id}`, data);
      return response.data;
    } catch (e) {
      throw e;
    }
  },

  delete: async (id) => {
    try {
      const response = await apiClient.delete(`/labs/${id}`);
      return response.data;
    } catch (e) {
      throw e;
    }
  },

  assignAssistant: async (labId, assistantUserId, assistantName) => {
    try {
      await apiClient.post(`/labs/${labId}/assign_assistant?assistant_id=${assistantUserId}`);
      // Return updated lab
      const labs = await labService.getAll();
      return labs.find(lab => lab.id === parseInt(labId) || lab.id === labId);
    } catch (e) {
      throw e;
    }
  },

  // --- FE-5: Use real stats from backend ---
  getStats: async () => {
    try {
      const response = await apiClient.get('/inventory/stats');
      const labs = await labService.getAll();
      return { ...response.data, totalLabs: labs.length };
    } catch (e) {
      return { totalEquipment: 0, available: 0, borrowed: 0, maintenance: 0, totalLabs: 0 };
    }
  }
};

