import { INITIAL_REQUESTS, INITIAL_TRANSFERS } from '../data/mockData';

let requestStore = [...INITIAL_REQUESTS];
let transferStore = [...INITIAL_TRANSFERS];

export const requestService = {
  getAllRequests: async () => {
    return [...requestStore];
  },

  getByRequester: async (requesterId) => {
    return requestStore.filter(req => req.requesterId === requesterId);
  },

  createRequest: async (data) => {
    const newReq = {
      id: `REQ-${Math.floor(5000 + Math.random() * 1000)}`,
      ...data,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'Pending'
    };
    requestStore.unshift(newReq);
    return newReq;
  },

  updateRequestStatus: async (id, status) => {
    requestStore = requestStore.map(req => req.id === id ? { ...req, status } : req);
    return requestStore.find(req => req.id === id);
  },

  getAllTransfers: async () => {
    return [...transferStore];
  },

  createTransfer: async (data) => {
    const newTransfer = {
      id: `TRF-${Math.floor(3000 + Math.random() * 1000)}`,
      ...data,
      status: 'Pending'
    };
    transferStore.unshift(newTransfer);
    return newTransfer;
  },

  updateTransferStatus: async (id, status) => {
    transferStore = transferStore.map(t => t.id === id ? { ...t, status } : t);
    return transferStore.find(t => t.id === id);
  }
};
