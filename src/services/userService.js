import apiClient from '../api/client';

const mapUser = (user) => ({
  ...user,
  assignedLabIds: user.assigned_labs || user.assignedLabIds || [],
  departmentId: user.department_id || user.departmentId || null,
  role: user.role ? user.role.toLowerCase() : 'student'
});

export const userService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/auth/users');
      return response.data.map(mapUser);
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
      return mapUser(response.data);
    } catch (e) {
      throw e;
    }
  },

  updateRole: async (id, newRole) => {
    try {
      const response = await apiClient.put(`/auth/users/${id}`, { role: newRole.toUpperCase() });
      return mapUser(response.data);
    } catch (e) {
      throw e;
    }
  },

  updateStatus: async (id, newStatus) => {
    if (newStatus === 'inactive' || newStatus === 'deleted') {
      try {
        const response = await apiClient.delete(`/auth/users/${id}`);
        return mapUser(response.data);
      } catch (e) {
        throw e;
      }
    }
    return { id, status: newStatus };
  },

  update: async (id, data) => {
    try {
      const response = await apiClient.put(`/auth/users/${id}`, data);
      return mapUser(response.data);
    } catch (e) {
      throw e;
    }
  },

  delete: async (id) => {
    try {
      const response = await apiClient.delete(`/auth/users/${id}`);
      return mapUser(response.data);
    } catch (e) {
      throw e;
    }
  }
};
