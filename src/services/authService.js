import apiClient from '../api/client';

const AUTH_KEY = 'labtrack_access_token';

export const authService = {
  login: async (email, password) => {
    // FastAPI OAuth2 expects form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await apiClient.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token } = response.data;
    localStorage.setItem(AUTH_KEY, access_token);
    
    // Fetch and return user profile
    const userRes = await apiClient.get('/auth/me');
    return { success: true, user: userRes.data };
  },

  logout: async () => {
    localStorage.removeItem(AUTH_KEY);
    return { success: true };
  },

  getCurrentUser: async () => {
    const token = localStorage.getItem(AUTH_KEY);
    if (!token) return null;
    try {
      const response = await apiClient.get('/auth/me');
      return response.data;
    } catch (e) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
  }
};
