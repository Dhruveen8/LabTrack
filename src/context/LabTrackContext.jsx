import React, { createContext, useContext, useState, useEffect } from 'react';
import { equipmentService } from '../services/equipmentService';
import { labService } from '../services/labService';
import { requestService } from '../services/requestService';
import { transactionService } from '../services/transactionService';
import { notificationService } from '../services/notificationService';
import { useToast } from './ToastContext';

const LabTrackContext = createContext(null);

export const LabTrackProvider = ({ children }) => {
  const { addToast } = useToast();
  const [equipmentList, setEquipmentList] = useState([]);
  const [labsList, setLabsList] = useState([]);
  const [requestsList, setRequestsList] = useState([]);
  const [transfersList, setTransfersList] = useState([]);
  const [transactionsList, setTransactionsList] = useState([]);
  const [notificationsList, setNotificationsList] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    try {
      const [eq, labs, reqs, trfs, txns, notifs] = await Promise.all([
        equipmentService.getAll(),
        labService.getAll(),
        requestService.getAllRequests(),
        requestService.getAllTransfers(),
        transactionService.getAll(),
        notificationService.getAll()
      ]);
      setEquipmentList(eq);
      setLabsList(labs);
      setRequestsList(reqs);
      setTransfersList(trfs);
      setTransactionsList(txns);
      setNotificationsList(notifs);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Actions
  const addEquipment = async (data) => {
    const newItem = await equipmentService.create(data);
    setEquipmentList(prev => [newItem, ...prev]);
    addToast(`Equipment "${newItem.name}" added successfully!`, 'success');
    return newItem;
  };

  const updateEquipment = async (id, data) => {
    const updated = await equipmentService.update(id, data);
    setEquipmentList(prev => prev.map(item => item.id === id ? updated : item));
    addToast('Equipment updated successfully', 'success');
    return updated;
  };

  const deleteEquipment = async (id) => {
    await equipmentService.delete(id);
    setEquipmentList(prev => prev.filter(item => item.id !== id));
    addToast('Equipment deleted', 'warning');
  };

  const issueEquipmentAction = async (issueData) => {
    const txn = await transactionService.issueEquipment(issueData);
    setTransactionsList(prev => [txn, ...prev]);

    // Update equipment availability
    const eq = equipmentList.find(e => e.id === issueData.equipmentId);
    if (eq) {
      const updatedEq = {
        ...eq,
        availableQuantity: Math.max(0, eq.availableQuantity - 1),
        borrowedQuantity: eq.borrowedQuantity + 1
      };
      await equipmentService.update(eq.id, updatedEq);
      setEquipmentList(prev => prev.map(e => e.id === eq.id ? updatedEq : e));
    }

    addToast(`Successfully issued equipment to ${issueData.borrowerName}`, 'success');
    return txn;
  };

  const returnEquipmentAction = async (transactionId, condition, remarks) => {
    const updatedTxn = await transactionService.returnEquipment(transactionId, condition, remarks);
    setTransactionsList(prev => prev.map(t => t.id === transactionId ? updatedTxn : t));

    if (updatedTxn) {
      const eq = equipmentList.find(e => e.id === updatedTxn.equipmentId);
      if (eq) {
        const updatedEq = {
          ...eq,
          availableQuantity: eq.availableQuantity + 1,
          borrowedQuantity: Math.max(0, eq.borrowedQuantity - 1)
        };
        await equipmentService.update(eq.id, updatedEq);
        setEquipmentList(prev => prev.map(e => e.id === eq.id ? updatedEq : e));
      }
    }

    addToast('Equipment successfully returned to laboratory inventory', 'success');
    return updatedTxn;
  };

  const createRequestAction = async (data) => {
    const newReq = await requestService.createRequest(data);
    setRequestsList(prev => [newReq, ...prev]);
    addToast('Equipment request submitted successfully', 'success');
    return newReq;
  };

  const updateRequestStatusAction = async (id, status) => {
    const updated = await requestService.updateRequestStatus(id, status);
    setRequestsList(prev => prev.map(r => r.id === id ? updated : r));
    addToast(`Request ${id} marked as ${status}`, 'info');
  };

  const createTransferAction = async (data) => {
    const newTrf = await requestService.createTransfer(data);
    setTransfersList(prev => [newTrf, ...prev]);
    addToast('Inter-Lab Transfer request initialized', 'success');
    return newTrf;
  };

  const updateTransferStatusAction = async (id, status) => {
    const updated = await requestService.updateTransferStatus(id, status);
    setTransfersList(prev => prev.map(t => t.id === id ? updated : t));
    addToast(`Transfer ${id} updated to ${status}`, 'info');
  };

  const markNotificationRead = async (id) => {
    const updatedList = await notificationService.markAsRead(id);
    setNotificationsList(updatedList);
  };

  const markAllNotificationsRead = async () => {
    const updatedList = await notificationService.markAllAsRead();
    setNotificationsList(updatedList);
  };

  return (
    <LabTrackContext.Provider
      value={{
        equipmentList,
        labsList,
        requestsList,
        transfersList,
        transactionsList,
        notificationsList,
        loading,
        refreshData,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        issueEquipmentAction,
        returnEquipmentAction,
        createRequestAction,
        updateRequestStatusAction,
        createTransferAction,
        updateTransferStatusAction,
        markNotificationRead,
        markAllNotificationsRead
      }}
    >
      {children}
    </LabTrackContext.Provider>
  );
};

export const useLabTrack = () => {
  const context = useContext(LabTrackContext);
  if (!context) throw new Error('useLabTrack must be used within a LabTrackProvider');
  return context;
};
