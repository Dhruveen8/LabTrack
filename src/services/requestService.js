import apiClient from '../api/client';

export const requestService = {
  getAllRequests: async () => {
    try {
      const response = await apiClient.get('/borrowing/requests');
      // Map backend fields to frontend-expected field names
      return response.data.map(req => ({
        id: req.id,
        requesterId: req.requester_id,
        equipmentId: req.model_id,
        labId: req.lab_id,
        requestDate: req.required_from,
        requiredFrom: req.required_from,
        requiredUntil: req.required_until,
        status: req.status.charAt(0).toUpperCase() + req.status.slice(1).toLowerCase(),
        unitAssetId: null,
        // Keep raw fields too for compatibility
        requester_id: req.requester_id,
        model_id: req.model_id,
        lab_id: req.lab_id
      }));
    } catch (e) {
      console.error('Error fetching requests', e);
      return [];
    }
  },

  getByRequester: async (requesterId) => {
    const all = await requestService.getAllRequests();
    return all.filter(req => req.requesterId === parseInt(requesterId) || req.requesterId === requesterId);
  },

  getByLab: async (labId) => {
    const all = await requestService.getAllRequests();
    return all.filter(req => req.labId === parseInt(labId) || req.labId === labId);
  },

  getApprovedByBorrower: async (borrowerId) => {
    const all = await requestService.getAllRequests();
    return all.filter(
      req => (req.requesterId === parseInt(borrowerId) || req.requesterId === borrowerId) &&
             req.status === 'Approved'
    );
  },

  createRequest: async (data) => {
    const payload = {
      model_id: parseInt(data.modelId || data.equipmentId),
      required_from: data.requiredFrom || new Date().toISOString(),
      required_until: data.requiredUntil || data.dueDate
    };
    try {
      const response = await apiClient.post('/borrowing/requests', payload);
      return response.data;
    } catch (e) {
      throw e;
    }
  },

  updateRequestStatus: async (id, status, extraData = {}) => {
    try {
      if (status === 'Approved' || status === 'APPROVED') {
        const res = await apiClient.post(`/borrowing/requests/${id}/approve`);
        return res.data;
      } else if (status === 'Rejected' || status === 'REJECTED') {
        const res = await apiClient.post(`/borrowing/requests/${id}/reject`, { reason: extraData.reason || 'Rejected' });
        return res.data;
      } else {
        console.warn('Status update not fully supported via API:', status);
        return { id, status };
      }
    } catch (e) {
      throw e;
    }
  },

  createExtensionRequest: async (originalRequestId, newDueDate, reason) => {
    console.warn('createExtensionRequest not implemented on backend');
    return { id: originalRequestId, status: 'EXTENSION_PENDING' };
  },

  approveExtension: async (requestId) => {
    console.warn('approveExtension not implemented on backend');
    return { id: requestId, status: 'EXTENDED' };
  },

  getAllTransfers: async () => {
    console.warn('Transfers not implemented on backend');
    return [];
  },

  createTransfer: async (data) => {
    console.warn('Transfers not implemented on backend');
    return { id: 'TRF-000', ...data, status: 'Pending' };
  },

  updateTransferStatus: async (id, status) => {
    console.warn('Transfers not implemented on backend');
    return { id, status };
  }
};
