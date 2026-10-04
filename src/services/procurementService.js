import apiClient from '../api/client';

export const procurementService = {
  getRecommendations: async () => {
    try {
      const response = await apiClient.get('/analytics/procurement/suggestions');
      return response.data.map((item, index) => ({
        id: `REC-${index + 1}`,
        model: item.name,
        category: 'Equipment',
        suggestedQuantity: parseInt(item.suggestion.replace(/\D/g, '')) || 5,
        reason: item.reason,
        status: 'pending'
      }));
    } catch (e) {
      console.error('Error fetching procurement suggestions', e);
      return [];
    }
  },
};
