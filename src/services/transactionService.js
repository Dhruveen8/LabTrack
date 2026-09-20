import apiClient from '../api/client';

export const transactionService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/borrowing/transactions');
      return response.data.map(txn => {
        // Map backend ACTIVE/RETURNED to UI Issued/Returned/Overdue
        let status = txn.status === 'ACTIVE' ? 'Issued' : (txn.status === 'RETURNED' ? 'Returned' : txn.status);
        if (status === 'Issued' && new Date(txn.due_date) < new Date()) {
          status = 'Overdue';
        }

        return {
          id: txn.id,
          requestId: txn.request_id,
          unitAssetId: txn.unit_asset_id,
          borrowerId: txn.borrower_id,
          labId: txn.lab_id,
          issueDate: txn.issue_date,
          dueDate: txn.due_date,
          returnDate: txn.return_date,
          status,
          reissuedCount: txn.reissued_count,
          // Keep raw fields too
          request_id: txn.request_id,
          unit_asset_id: txn.unit_asset_id,
          borrower_id: txn.borrower_id,
          lab_id: txn.lab_id
        };
      });
    } catch (e) {
      console.error('Error fetching transactions', e);
      return [];
    }
  },

  getByBorrower: async (borrowerId) => {
    const all = await transactionService.getAll();
    return all.filter(txn => txn.borrowerId === parseInt(borrowerId) || txn.borrowerId === borrowerId);
  },

  getActiveByUnitAssetId: async (assetId) => {
    const all = await transactionService.getAll();
    return all.find(
      txn => txn.unitAssetId === assetId &&
             (txn.status === 'Issued' || txn.status === 'Overdue')
    ) || null;
  },

  issueEquipment: async (issueData) => {
    try {
      const response = await apiClient.post('/borrowing/checkout', {
        request_id: issueData.requestId,
        asset_id: issueData.unitAssetId
      });
      return response.data;
    } catch (e) {
      throw e;
    }
  },

  returnEquipment: async (transactionId, assetId, returnCondition, remarks) => {
    
    try {
      const response = await apiClient.post('/borrowing/return', {
        asset_id: assetId,
        condition_remarks: returnCondition ? `${returnCondition}${remarks ? ' - ' + remarks : ''}` : (remarks || null)
      });
      return response.data;
    } catch (e) {
      throw e;
    }
  },

  extendDueDate: async (transactionId, newDueDate) => {
    console.warn('extendDueDate not implemented directly on transaction backend');
    return { id: transactionId };
  }
};
