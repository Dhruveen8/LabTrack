import apiClient from '../api/client';
import { labService } from './labService';

export const equipmentService = {
  getAll: async () => {
    try {
      const [modelsRes, unitsRes, labsRes] = await Promise.all([
        apiClient.get('/inventory/models'),
        apiClient.get('/inventory/units'),
        labService.getAll()
      ]);

      const models = modelsRes.data;
      const units = unitsRes.data;
      const labs = labsRes;

      // Merge them into the format expected by the frontend
      return models.map(model => {
        const modelUnits = units.filter(u => u.model_id === model.id);
        const availableCount = modelUnits.filter(u => u.status === 'AVAILABLE' && u.lab_id === model.lab_id).length;
        const borrowedCount = modelUnits.filter(u => u.status === 'ISSUED').length;
        const lab = labs.find(l => l.id === model.lab_id) || {};

        return {
          id: model.id, // Ensure it's string if needed, but int works
          name: model.name,
          category: model.category,
          labId: model.lab_id,
          labName: lab.name || 'Unknown Lab',
          description: model.description || '',
          quantity: model.total_quantity,
          availableQuantity: availableCount,
          borrowedQuantity: borrowedCount,
          status: availableCount > 0 ? 'Available' : 'Unavailable',
          condition: 'Mixed',
          units: modelUnits.map(u => ({
            assetId: u.asset_id,
            labId: u.lab_id,
            status: u.status === 'AVAILABLE' ? 'Available' : (u.status === 'ISSUED' ? 'Issued' : 'Maintenance'),
            condition: u.condition || 'Excellent',
            serialNumber: u.serial_number || u.asset_id,
            qrCodeUrl: u.qr_code_url
          }))
        };
      });
    } catch (e) {
      console.error('Error fetching equipment', e);
      return [];
    }
  },

  getById: async (id) => {
    const all = await equipmentService.getAll();
    return all.find(item => item.id === parseInt(id) || item.id === id) || null;
  },

  getByLab: async (labId) => {
    const all = await equipmentService.getAll();
    return all.filter(item => item.labId === parseInt(labId) || item.labId === labId);
  },

  getByUnitAssetId: async (assetId) => {
    const all = await equipmentService.getAll();
    for (const eq of all) {
      if (eq.units) {
        const unit = eq.units.find(u => u.assetId === assetId);
        if (unit) {
          return { equipment: eq, unit };
        }
      }
      if (eq.id === parseInt(assetId) || eq.id === assetId) {
        return { equipment: eq, unit: eq.units ? eq.units[0] : null };
      }
    }
    return null;
  },

  create: async (data) => {
    const qty = parseInt(data.quantity, 10) || 1;

    // 1. Create model
    const modelPayload = {
      name: data.name,
      category: data.category || 'GEN',
      description: data.description || '',
      lab_id: parseInt(data.labId)
    };

    const modelRes = await apiClient.post('/inventory/models', modelPayload);
    const createdModel = modelRes.data;

    // 2. Create units
    for (let i = 0; i < qty; i++) {
      const unitPayload = {
        model_id: createdModel.id,
        serial_number: data.serialNumber ? `${data.serialNumber}-${i+1}` : null,
        condition: data.condition || 'Excellent'
      };
      await apiClient.post('/inventory/units', unitPayload);
    }

    return await equipmentService.getById(createdModel.id);
  },

  bulkCreate: async (itemsList) => {
    const createdItems = [];
    for (const item of itemsList) {
      const created = await equipmentService.create(item);
      createdItems.push(created);
    }
    return createdItems;
  },

  bulkImportExcel: async (payload) => {
    const response = await apiClient.post('/inventory/import_excel', payload);
    return response.data;
  },

  update: async (id, updatedData) => {
    const response = await apiClient.put(`/inventory/models/${id}`, updatedData);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/inventory/models/${id}`);
    return response.data;
  },

  updateUnitStatus: async (assetId, newStatus, condition = null) => {
    const payload = {};
    if (newStatus) payload.status = newStatus.toUpperCase();
    if (condition) payload.condition = condition;
    const response = await apiClient.patch(`/inventory/units/${assetId}/status`, payload);
    return response.data;
  }
};
