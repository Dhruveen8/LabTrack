import apiClient from '../api/client';

const mapLab = lab => ({ ...lab, displayId: lab.display_id || `LAB-${lab.code}` });

export const labService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/labs/');
      return response.data.map(mapLab);
    } catch (e) {
      console.error('Error fetching labs', e);
      return [];
    }
  },

  getAssignments: async () => {
    try {
      const response = await apiClient.get('/labs/assignments');
      return response.data;
    } catch {
      return [];
    }
  },

  getById: async (id) => {
    try {
      const labs = await labService.getAll();
      return labs.find(lab => lab.id === parseInt(id) || lab.id === id) || null;
    } catch {
      return null;
    }
  },

  getByDepartment: async (deptId) => {
    try {
      const labs = await labService.getAll();
      return labs.filter(lab => lab.department_id === parseInt(deptId) || lab.department_id === deptId);
    } catch {
      return [];
    }
  },

  getByAssistant: async (userId) => {
    try {
      const [labs, assignments] = await Promise.all([labService.getAll(), labService.getAssignments()]);
      const myLabIds = assignments.filter(a => a.assistant_id === parseInt(userId) || a.assistant_id === userId).map(a => a.lab_id);
      return labs.filter(lab => myLabIds.includes(lab.id));
    } catch {
      return [];
    }
  },

  create: async (data) => {
    const payload = {
      name: data.name,
      code: data.code,
      department_id: data.departmentId || data.department_id,
      location: data.location || null
    };
    const response = await apiClient.post('/labs/', payload);
    return mapLab(response.data);
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/labs/${id}`, data);
    return mapLab(response.data);
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/labs/${id}`);
    return response.data;
  },

  assignAssistant: async (labId, assistantUserId, _assistantName) => {
    await apiClient.post(`/labs/${labId}/assign_assistant?assistant_id=${assistantUserId}`);
    // Return updated lab
    const labs = await labService.getAll();
    return labs.find(lab => lab.id === parseInt(labId) || lab.id === labId);
  },

  // --- FE-5: Use real stats from backend ---
  getStats: async () => {
    try {
      const response = await apiClient.get('/inventory/stats');
      const labs = await labService.getAll();
      return { ...response.data, totalLabs: labs.length };
    } catch {
      return { totalEquipment: 0, available: 0, borrowed: 0, maintenance: 0, totalLabs: 0 };
    }
  }
};
