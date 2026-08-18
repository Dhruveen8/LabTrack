import { INITIAL_TRANSACTIONS } from '../data/mockData';

const TXN_STORAGE_KEY = 'labtrack_transactions';

const getInitialData = () => {
  const saved = localStorage.getItem(TXN_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return [...INITIAL_TRANSACTIONS];
};

let transactionStore = getInitialData();

const persist = () => {
  try {
    localStorage.setItem(TXN_STORAGE_KEY, JSON.stringify(transactionStore));
  } catch (e) {
    console.error('Failed to persist transactions to localStorage', e);
  }
};

export const transactionService = {
  getAll: async () => {
    return [...transactionStore];
  },

  getByBorrower: async (borrowerId) => {
    return transactionStore.filter(txn => txn.borrowerId === borrowerId);
  },

  getActiveByUnitAssetId: async (assetId) => {
    return transactionStore.find(
      txn => (txn.unitAssetId === assetId || txn.equipmentId === assetId) &&
             (txn.status === 'Issued' || txn.status === 'Overdue')
    ) || null;
  },

  issueEquipment: async (issueData) => {
    const newTxn = {
      id: `TXN-${Math.floor(9000 + Math.random() * 1000)}`,
      requestId: issueData.requestId || null,
      equipmentId: issueData.equipmentId,
      equipmentName: issueData.equipmentName,
      unitAssetId: issueData.unitAssetId,
      borrowerName: issueData.borrowerName,
      borrowerId: issueData.borrowerId,
      borrowerType: issueData.borrowerRole || 'student',
      labId: issueData.labId || 'LAB-GEN',
      originLab: issueData.labName || 'Main Lab',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: issueData.dueDate,
      returnDate: null,
      status: 'Issued',
      reissuedCount: 0
    };
    transactionStore.unshift(newTxn);
    persist();
    return newTxn;
  },

  returnEquipment: async (transactionId, returnCondition, remarks) => {
    transactionStore = transactionStore.map(txn => {
      if (txn.id === transactionId || txn.unitAssetId === transactionId || txn.equipmentId === transactionId) {
        return {
          ...txn,
          returnDate: new Date().toISOString().split('T')[0],
          status: 'Returned',
          conditionOnReturn: returnCondition,
          remarks: remarks
        };
      }
      return txn;
    });
    persist();
    return transactionStore.find(txn => txn.id === transactionId || txn.unitAssetId === transactionId || txn.equipmentId === transactionId);
  },

  extendDueDate: async (transactionId, newDueDate) => {
    transactionStore = transactionStore.map(txn => {
      if (txn.id === transactionId) {
        return {
          ...txn,
          dueDate: newDueDate,
          reissuedCount: (txn.reissuedCount || 0) + 1,
          status: 'Issued'
        };
      }
      return txn;
    });
    persist();
    return transactionStore.find(txn => txn.id === transactionId);
  }
};
