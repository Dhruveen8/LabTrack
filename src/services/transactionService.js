import { INITIAL_TRANSACTIONS } from '../data/mockData';

let transactionStore = [...INITIAL_TRANSACTIONS];

export const transactionService = {
  getAll: async () => {
    return [...transactionStore];
  },

  getByBorrower: async (borrowerId) => {
    return transactionStore.filter(txn => txn.borrowerId === borrowerId);
  },

  issueEquipment: async (issueData) => {
    const newTxn = {
      id: `TXN-${Math.floor(9000 + Math.random() * 1000)}`,
      equipmentId: issueData.equipmentId,
      equipmentName: issueData.equipmentName,
      borrowerName: issueData.borrowerName,
      borrowerId: issueData.borrowerId,
      borrowerType: issueData.borrowerRole || 'Student',
      originLab: issueData.labName || 'Main Lab',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: issueData.dueDate,
      returnDate: null,
      status: 'Issued'
    };
    transactionStore.unshift(newTxn);
    return newTxn;
  },

  returnEquipment: async (transactionId, returnCondition, remarks) => {
    transactionStore = transactionStore.map(txn => {
      if (txn.id === transactionId || txn.equipmentId === transactionId) {
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
    return transactionStore.find(txn => txn.id === transactionId || txn.equipmentId === transactionId);
  }
};
