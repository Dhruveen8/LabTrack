import apiClient from '../api/client';

export const reportService = {
  getSummaryStats: async () => {
    try {
      const response = await apiClient.get('/analytics/reports/system');
      const data = response.data;
      return {
        totalEquipment: data.totalUnits || 0,
        totalBorrowings: data.totalTransactions || 0,
        overdueItems: data.overdueTransactions || 0,
        activeTransfers: data.activeTransfers || 0
      };
    } catch (e) {
      console.error('Error fetching stats', e);
      return {
        totalEquipment: 0,
        totalBorrowings: 0,
        overdueItems: 0,
        activeTransfers: 0
      };
    }
  },

  getMonthlyBorrowingTrends: async () => {
    try {
      const response = await apiClient.get('/analytics/reports/trends');
      return response.data;
    } catch (e) {
      console.error('Error fetching trends', e);
      return [];
    }
  },

  getLabUtilization: async () => {
    try {
      const response = await apiClient.get('/analytics/reports/lab-utilization');
      return response.data;
    } catch (e) {
      console.error('Error fetching lab utilization', e);
      return [];
    }
  },

  getMostUsedEquipment: async () => {
    try {
      const response = await apiClient.get('/analytics/reports/top-equipment');
      return response.data;
    } catch (e) {
      console.error('Error fetching most used equipment', e);
      return [];
    }
  }
};
