import { SMART_PROCUREMENT_DATA } from '../data/mockData';

let procurementStore = [...SMART_PROCUREMENT_DATA];

export const procurementService = {
  getRecommendations: async () => {
    return [...procurementStore];
  },

  updateItem: async (id, updated) => {
    procurementStore = procurementStore.map(item => item.id === id ? { ...item, ...updated } : item);
    return procurementStore.find(item => item.id === id);
  }
};
