import apiClient from '../api/client';

export const userService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/auth/users');
      return response.data;
    } catch (e) {
      console.error('Error fetching users', e);
      return [];
    }
  },

  getById: async (id) => {
    const all = await userService.getAll();
    return all.find(user => user.id === parseInt(id) || user.id === id) || null;
  },

  getAssistants: async () => {
    const all = await userService.getAll();
    return all.filter(u => u.role === 'ASSISTANT' || u.role === 'assistant');
  },

  assignLabsToAssistant: async (userId, labIds = []) => {
    console.warn('assignLabsToAssistant not directly supported. Use labService.assignAssistant instead');
    return await userService.getById(userId);
  },

  create: async (data) => {
    const payload = {
      email: data.email,
      password: data.password || 'default123',
      name: data.name,
      role: (data.role || 'STUDENT').toUpperCase(),
      department_id: data.departmentId ? parseInt(data.departmentId) : null,
      assigned_labs: data.assignedLabIds || []
    };
    try {
      const response = await apiClient.post('/auth/register', payload);
      return response.data;
    } catch (e) {
      throw e;
    }
  },

  updateRole: async (id, newRole) => {
    console.warn('updateRole not implemented on backend');
    return { id, role: newRole };
  },

  updateStatus: async (id, newStatus) => {
    console.warn('updateStatus not implemented on backend');
    return { id, status: newStatus };
  }
};
