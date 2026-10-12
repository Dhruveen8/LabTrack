import apiClient from '../api/client';

export const cartService = {
  get: async () => (await apiClient.get('/borrowing/cart')).data,
  update: async (modelId, labId, quantity) =>
    (await apiClient.put(`/borrowing/cart/items/${modelId}/${labId}`, { quantity })).data,
  remove: async (modelId, labId) =>
    (await apiClient.delete(`/borrowing/cart/items/${modelId}/${labId}`)).data,
  submit: async (body) => (await apiClient.post('/borrowing/cart/submit', body)).data,
};
