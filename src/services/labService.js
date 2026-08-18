import { INITIAL_LABS } from '../data/mockData';

const STORAGE_KEY = 'labtrack_labs';

const getInitialData = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_LABS];
};

let labStore = getInitialData();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(labStore));
  } catch (e) {
    console.error('Failed to persist labs to localStorage', e);
  }
};

export const labService = {
  getAll: async () => {
    return [...labStore];
  },

  getById: async (id) => {
    return labStore.find(lab => lab.id === id) || null;
  },

  getByDepartment: async (deptId) => {
    return labStore.filter(lab => lab.departmentId === deptId);
  },

  getByAssistant: async (userId) => {
    return labStore.filter(lab => lab.inchargeUserId === userId);
  },

  create: async (data) => {
    const newLab = {
      id: data.id || `LAB-${(data.code || data.name.substring(0, 3)).toUpperCase()}`,
      totalEquipment: 0,
      available: 0,
      borrowed: 0,
      maintenance: 0,
      pendingTransfers: 0,
      ...data
    };
    labStore.push(newLab);
    persist();
    return newLab;
  },

  update: async (id, data) => {
    labStore = labStore.map(lab => lab.id === id ? { ...lab, ...data } : lab);
    persist();
    return labStore.find(lab => lab.id === id);
  },

  delete: async (id) => {
    labStore = labStore.filter(lab => lab.id !== id);
    persist();
    return { success: true };
  },

  assignAssistant: async (labId, assistantUserId, assistantName) => {
    labStore = labStore.map(lab => {
      if (lab.id === labId) {
        return {
          ...lab,
          inchargeUserId: assistantUserId,
          incharge: assistantName
        };
      }
      return lab;
    });
    persist();
    return labStore.find(lab => lab.id === labId);
  },

  getStats: async () => {
    const totalEquipment = labStore.reduce((acc, lab) => acc + (lab.totalEquipment || 0), 0);
    const available = labStore.reduce((acc, lab) => acc + (lab.available || 0), 0);
    const borrowed = labStore.reduce((acc, lab) => acc + (lab.borrowed || 0), 0);
    const maintenance = labStore.reduce((acc, lab) => acc + (lab.maintenance || 0), 0);
    return { totalEquipment, available, borrowed, maintenance, totalLabs: labStore.length };
  }
};
