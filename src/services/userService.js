import apiClient from '../api/client';
import { resolveInstitutionalId } from '../utils/userIds';

const mapUser = (user) => ({
  ...user,
  displayId: user.display_id,
  universityId: user.university_id,
  accountStatus: user.account_status || 'PENDING',
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

  assignLabsToAssistant: async (userId, _labIds = []) => {
    console.warn('assignLabsToAssistant not directly supported. Use labService.assignAssistant instead');
    return await userService.getById(userId);
  },

  create: async (data) => {
    const payload = {
      email: data.email,
      password: data.password || 'default123',
      name: data.name,
      university_id: resolveInstitutionalId((data.role || 'student').toLowerCase(), data.universityId, data.email),
      role: (data.role || 'STUDENT').toUpperCase(),
      department_id: data.departmentId ? parseInt(data.departmentId) : null
    };
    const response = await apiClient.post('/auth/register', payload);
    return mapUser(response.data);
  },

  updateRole: async (id, newRole) => {
    const response = await apiClient.put(`/auth/users/${id}`, { role: newRole.toUpperCase() });
    return mapUser(response.data);
  },

  updateStatus: async (id, newStatus) => {
    const response = await apiClient.put(`/auth/users/${id}`, { account_status: newStatus.toUpperCase() });
    return mapUser(response.data);
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/auth/users/${id}`, data);
    return mapUser(response.data);
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/auth/users/${id}`);
    return mapUser(response.data);
  }
};
