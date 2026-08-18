import { INITIAL_DEPARTMENTS } from '../data/mockData';

const DEPT_STORAGE_KEY = 'labtrack_departments';

const getInitialData = () => {
  const saved = localStorage.getItem(DEPT_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_DEPARTMENTS];
};

let departmentStore = getInitialData();

const persist = () => {
  try {
    localStorage.setItem(DEPT_STORAGE_KEY, JSON.stringify(departmentStore));
  } catch (e) {
    console.error('Failed to persist departments to localStorage', e);
  }
};

export const departmentService = {
  getAll: async () => {
    return [...departmentStore];
  },

  getById: async (id) => {
    return departmentStore.find(d => d.id === id) || null;
  },

  create: async (data) => {
    const newDept = {
      id: data.id || `DEPT-${(data.code || data.name.substring(0, 3)).toUpperCase()}`,
      ...data,
      totalLabs: data.totalLabs || 0
    };
    departmentStore.push(newDept);
    persist();
    return newDept;
  },

  update: async (id, data) => {
    departmentStore = departmentStore.map(d => d.id === id ? { ...d, ...data } : d);
    persist();
    return departmentStore.find(d => d.id === id);
  },

  delete: async (id) => {
    departmentStore = departmentStore.filter(d => d.id !== id);
    persist();
    return { success: true };
  }
};
