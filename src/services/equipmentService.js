import { INITIAL_EQUIPMENT } from '../data/mockData';
import { generateBulkAssetIds } from '../utils/assetIdGenerator';

const STORAGE_KEY = 'labtrack_equipment';

const getInitialData = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_EQUIPMENT];
};

let equipmentStore = getInitialData();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(equipmentStore));
  } catch (e) {
    console.error('Failed to persist equipment to localStorage', e);
  }
};

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

  getByUnitAssetId: async (assetId) => {
    for (const eq of equipmentStore) {
      if (eq.units) {
        const unit = eq.units.find(u => u.assetId === assetId);
        if (unit) {
          return { equipment: eq, unit };
        }
      }
      if (eq.id === assetId || eq.qrCode === assetId) {
        return { equipment: eq, unit: eq.units ? eq.units[0] : null };
      }
    }
    return null;
  },

  create: async (data) => {
    const qty = parseInt(data.quantity, 10) || 1;
    const labId = data.labId || 'LAB-IOT';
    const labName = data.labName || 'Laboratory';
    const category = data.category || 'General Equipment';

    // Generate individual unit records and asset IDs
    const assetIds = generateBulkAssetIds(labId, labName, category, qty, equipmentStore);
    
    const units = assetIds.map((assetId, idx) => ({
      assetId,
      name: data.name,
      status: 'Available',
      condition: data.condition || 'Excellent',
      serialNumber: data.serialNumber ? `${data.serialNumber}-${idx + 1}` : assetId,
      qrCodeUrl: `https://labtrack.univ.edu/equipment/${assetId}`
    }));

    const newItem = {
      ...data,
      id: data.id || `EQ-${Math.floor(1000 + Math.random() * 9000)}`,
      quantity: qty,
      availableQuantity: qty,
      borrowedQuantity: 0,
      status: 'Available',
      condition: data.condition || 'Excellent',
      units
    };

    equipmentStore.unshift(newItem);
    persist();
    return newItem;
  },

  bulkCreate: async (itemsList) => {
    const createdItems = [];
    for (const item of itemsList) {
      const created = await equipmentService.create(item);
      createdItems.push(created);
    }
    return createdItems;
  },

  update: async (id, updatedData) => {
    equipmentStore = equipmentStore.map(item => 
      item.id === id ? { ...item, ...updatedData } : item
    );
    persist();
    return equipmentStore.find(item => item.id === id);
  },

  delete: async (id) => {
    equipmentStore = equipmentStore.filter(item => item.id !== id);
    persist();
    return { success: true };
  },

  updateUnitStatus: async (assetId, newStatus, condition = null) => {
    let updatedParent = null;

    equipmentStore = equipmentStore.map(eq => {
      if (!eq.units) return eq;
      let hasUnit = false;
      const newUnits = eq.units.map(unit => {
        if (unit.assetId === assetId) {
          hasUnit = true;
          return {
            ...unit,
            status: newStatus,
            condition: condition || unit.condition
          };
        }
        return unit;
      });

      if (hasUnit) {
        const availableCount = newUnits.filter(u => u.status === 'Available').length;
        const borrowedCount = newUnits.filter(u => u.status === 'Issued').length;
        updatedParent = {
          ...eq,
          units: newUnits,
          availableQuantity: availableCount,
          borrowedQuantity: borrowedCount,
          status: availableCount > 0 ? 'Available' : 'Unavailable'
        };
        return updatedParent;
      }
      return eq;
    });

    persist();
    return updatedParent;
  }
};
