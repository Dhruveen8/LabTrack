import { INITIAL_REQUESTS, INITIAL_TRANSFERS } from '../data/mockData';

const REQ_STORAGE_KEY = 'labtrack_requests';
const TRF_STORAGE_KEY = 'labtrack_transfers';

const getInitialRequests = () => {
  const saved = localStorage.getItem(REQ_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_REQUESTS];
};

const getInitialTransfers = () => {
  const saved = localStorage.getItem(TRF_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_TRANSFERS];
};

let requestStore = getInitialRequests();
let transferStore = getInitialTransfers();

const persist = () => {
  try {
    localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(requestStore));
    localStorage.setItem(TRF_STORAGE_KEY, JSON.stringify(transferStore));
  } catch (e) {
    console.error('Failed to persist requests to localStorage', e);
  }
};

export const requestService = {
  getAllRequests: async () => {
    return [...requestStore];
  },

  getByRequester: async (requesterId) => {
    return requestStore.filter(req => req.requesterId === requesterId);
  },

  getByLab: async (labId) => {
    return requestStore.filter(req => req.labId === labId);
  },

  getApprovedByBorrower: async (borrowerId) => {
    return requestStore.filter(
      req => (req.requesterId === borrowerId || req.requesterName?.toLowerCase().includes(borrowerId.toLowerCase())) &&
             req.status === 'Approved'
    );
  },

  createRequest: async (data) => {
    const newReq = {
      id: `REQ-${Math.floor(5000 + Math.random() * 5000)}`,
      ...data,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      unitAssetId: null
    };
    requestStore.unshift(newReq);
    persist();
    return newReq;
  },

  updateRequestStatus: async (id, status, extraData = {}) => {
    requestStore = requestStore.map(req => 
      req.id === id ? { ...req, status, ...extraData } : req
    );
    persist();
    return requestStore.find(req => req.id === id);
  },

  createExtensionRequest: async (originalRequestId, newDueDate, reason) => {
    const orig = requestStore.find(r => r.id === originalRequestId);
    if (!orig) throw new Error('Original request not found');

    const updated = {
      ...orig,
      status: 'Extension_Pending',
      requestedNewDueDate: newDueDate,
      extensionReason: reason
    };

    requestStore = requestStore.map(r => r.id === originalRequestId ? updated : r);
    persist();
    return updated;
  },

  approveExtension: async (requestId) => {
    const orig = requestStore.find(r => r.id === requestId);
    if (!orig) throw new Error('Request not found');

    const updated = {
      ...orig,
      status: 'Extended',
      requiredUntil: orig.requestedNewDueDate || orig.requiredUntil,
      previousDueDate: orig.requiredUntil,
      requestedNewDueDate: null
    };

    requestStore = requestStore.map(r => r.id === requestId ? updated : r);
    persist();
    return updated;
  },

  getAllTransfers: async () => {
    return [...transferStore];
  },

  createTransfer: async (data) => {
    const newTransfer = {
      id: `TRF-${Math.floor(3000 + Math.random() * 7000)}`,
      ...data,
      status: 'Pending'
    };
    transferStore.unshift(newTransfer);
    persist();
    return newTransfer;
  },

  updateTransferStatus: async (id, status) => {
    transferStore = transferStore.map(t => t.id === id ? { ...t, status } : t);
    persist();
    return transferStore.find(t => t.id === id);
  }
};
