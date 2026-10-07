import apiClient from '../api/client';

export const requestService = {
  getAllRequests: async () => {
    try {
      const response = await apiClient.get('/borrowing/requests');
      // Map backend fields to frontend-expected field names
      return response.data.map(req => ({
        id: req.id,
        requesterId: req.requester_id,
        requesterName: req.requester_name,
        requesterRole: req.requester_role?.toLowerCase(),
        equipmentId: req.model_id,
        labId: req.lab_id,
        requestDate: req.required_from,
        requiredFrom: req.required_from,
        requiredUntil: req.required_until,
        status: req.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
        unitAssetId: null,
        kind: req.kind,
        quantity: req.quantity,
        purpose: req.purpose,
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
      required_until: data.requiredUntil || data.dueDate,
      kind: data.kind || 'STANDARD',
      quantity: parseInt(data.quantity) || 1,
      purpose: data.purpose || 'Academic Request'
    };
    const response = await apiClient.post('/borrowing/requests', payload);
    return response.data;
  },

  updateRequestStatus: async (id, status, extraData = {}) => {
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
  },

  createExtensionRequest: async (originalRequestId, newDueDate, reason) => {
    const response = await apiClient.post(`/borrowing/requests/${originalRequestId}/extend`, {
      new_due_date: newDueDate,
      reason: reason
    });
    return response.data;
  },

  approveExtension: async (requestId) => {
    const response = await apiClient.post(`/borrowing/requests/${requestId}/approve-extension`);
    return response.data;
  },

  getAllTransfers: async () => {
    try {
      const response = await apiClient.get('/transfers/');
      return response.data.map(tr => ({
        id: tr.id,
        fromLabId: tr.from_lab_id,
        toLabId: tr.to_lab_id,
        requesterId: tr.requester_id,
        requesterName: tr.requester_name,
        status: tr.status.charAt(0).toUpperCase() + tr.status.slice(1).toLowerCase(),
        reason: tr.reason,
        requestDate: tr.created_at,
        resolvedDate: tr.resolved_at
      }));
    } catch (e) {
      console.error('Error fetching transfers', e);
      return [];
    }
  },

  createTransfer: async (data) => {
    const payload = {
      from_lab_id: parseInt(data.fromLabId),
      to_lab_id: parseInt(data.toLabId),
      unit_asset_ids: data.unitAssetIds || [],
      reason: data.reason || null
    };
    const response = await apiClient.post('/transfers/', payload);
    return response.data;
  },

  updateTransferStatus: async (id, status, decisionReason = null) => {
    const payload = { status: status.toUpperCase() };
    if (decisionReason) payload.decision_reason = decisionReason;
    const response = await apiClient.patch(`/transfers/${id}/status`, payload);
    return response.data;
  },

  createEventIssue: async (data) => {
    const payload = {
      event_name: data.eventName,
      purpose: data.purpose,
      coordinator_id: data.coordinatorId,
      due_date: new Date(data.returnDate).toISOString(),
      unit_asset_ids: data.unitAssetIds
    };
    const response = await apiClient.post('/borrowing/events/requests', payload);
    return response.data;
  },

  getEventRequests: async () => (await apiClient.get('/borrowing/events/requests')).data,

  approveEventRequest: async (id) => (await apiClient.post(`/borrowing/events/requests/${id}/approve`)).data,

  rejectEventRequest: async (id, reason) => (await apiClient.post(`/borrowing/events/requests/${id}/reject`, { reason })).data,
};
