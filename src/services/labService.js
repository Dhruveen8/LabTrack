import { INITIAL_LABS } from '../data/mockData';

let labStore = [...INITIAL_LABS];

export const labService = {
  getAll: async () => {
    return [...labStore];
  },

  getById: async (id) => {
    return labStore.find(lab => lab.id === id) || null;
  },

  getStats: async () => {
    const totalEquipment = labStore.reduce((acc, lab) => acc + lab.totalEquipment, 0);
    const available = labStore.reduce((acc, lab) => acc + lab.available, 0);
    const borrowed = labStore.reduce((acc, lab) => acc + lab.borrowed, 0);
    const maintenance = labStore.reduce((acc, lab) => acc + lab.maintenance, 0);
    return { totalEquipment, available, borrowed, maintenance, totalLabs: labStore.length };
  }
};
