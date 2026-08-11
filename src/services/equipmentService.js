import { INITIAL_EQUIPMENT } from '../data/mockData';

let equipmentStore = [...INITIAL_EQUIPMENT];

export const equipmentService = {
  getAll: async () => {
    return [...equipmentStore];
  },

  getById: async (id) => {
    return equipmentStore.find(item => item.id === id) || null;
  },

  getByLab: async (labId) => {
    return equipmentStore.filter(item => item.labId === labId);
  },

  create: async (data) => {
    const newItem = {
      ...data,
      id: data.id || `EQ-${Math.floor(1000 + Math.random() * 9000)}`,
      borrowedQuantity: 0,
      availableQuantity: parseInt(data.quantity, 10) || 1,
      status: data.status || 'Available',
      qrCode: data.id || `EQ-${Math.floor(1000 + Math.random() * 9000)}`
    };
    equipmentStore.unshift(newItem);
    return newItem;
  },

  update: async (id, updatedData) => {
    equipmentStore = equipmentStore.map(item => 
      item.id === id ? { ...item, ...updatedData } : item
    );
    return equipmentStore.find(item => item.id === id);
  },

  delete: async (id) => {
    equipmentStore = equipmentStore.filter(item => item.id !== id);
    return { success: true };
  }
};
