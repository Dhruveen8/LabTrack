import { REPORT_ANALYTICS_DATA } from '../data/mockData';

export const reportService = {
  getSummaryStats: async () => {
    return { ...REPORT_ANALYTICS_DATA.summaryStats };
  },

  getMonthlyBorrowingTrends: async () => {
    return [...REPORT_ANALYTICS_DATA.monthlyBorrowingTrends];
  },

  getLabUtilization: async () => {
    return [...REPORT_ANALYTICS_DATA.labUtilization];
  },

  getMostUsedEquipment: async () => {
    return [...REPORT_ANALYTICS_DATA.mostUsedEquipment];
  }
};
