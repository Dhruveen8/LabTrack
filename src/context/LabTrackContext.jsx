import React, { createContext, useContext, useState, useEffect } from 'react';
import { departmentService } from '../services/departmentService';
import { equipmentService } from '../services/equipmentService';
import { labService } from '../services/labService';
import { requestService } from '../services/requestService';
import { transactionService } from '../services/transactionService';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { settingsService } from '../services/settingsService';
import { useToast } from './ToastContext';

const LabTrackContext = createContext(null);

export const LabTrackProvider = ({ children }) => {
  const { addToast } = useToast();
  const [departmentsList, setDepartmentsList] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [labsList, setLabsList] = useState([]);
  const [requestsList, setRequestsList] = useState([]);
  const [transfersList, setTransfersList] = useState([]);
  const [transactionsList, setTransactionsList] = useState([]);
  const [notificationsList, setNotificationsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [systemSettings, setSystemSettings] = useState({
    studentBorrowLimitDays: 14,
    facultyBorrowLimitDays: 30,
    emailOverdueAlerts: true,
    transferAlerts: true,
    allowSelfRenewal: true
  });
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    try {
      const [depts, eq, labs, reqs, trfs, txns, notifs, users, settings] = await Promise.all([
        departmentService.getAll(),
        equipmentService.getAll(),
        labService.getAll(),
        requestService.getAllRequests(),
        requestService.getAllTransfers(),
        transactionService.getAll(),
        notificationService.getAll(),
        userService.getAll(),
        settingsService.get()
      ]);
      setDepartmentsList(depts);
      setEquipmentList(eq);
      setLabsList(labs);
      setRequestsList(reqs);
      setTransfersList(trfs);
      setTransactionsList(txns);
      setNotificationsList(notifs);
      setUsersList(users);
      if (settings) setSystemSettings(settings);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // System Settings (Admin can modify borrowing limits)
  const updateSystemSettingsAction = async (newSettings) => {
    const updated = await settingsService.update(newSettings);
    setSystemSettings(updated);
    addToast('Institutional borrowing limits & portal settings updated', 'success');
    return updated;
  };

  // User Registration Actions (Admin can add new Lab Assistants, Faculty, Students)
  const addUser = async (userData) => {
    const newUser = await userService.create(userData);
    setUsersList(prev => [...prev, newUser]);

    // If assistant was assigned to labs during registration, update those labs
    if (newUser.role === 'assistant' && newUser.assignedLabIds && newUser.assignedLabIds.length > 0) {
      for (const labId of newUser.assignedLabIds) {
        const updatedLab = await labService.assignAssistant(labId, newUser.id, newUser.name);
        setLabsList(prev => prev.map(l => l.id === labId ? updatedLab : l));
      }
    }

    addToast(`User "${newUser.name}" (${newUser.role}) successfully registered`, 'success');
    return newUser;
  };

  // Department Actions (Admin only)
  const addDepartment = async (data) => {
    const newDept = await departmentService.create(data);
    setDepartmentsList(prev => [...prev, newDept]);
    addToast(`Department "${newDept.name}" created`, 'success');
    return newDept;
  };

  const updateDepartment = async (id, data) => {
    const updated = await departmentService.update(id, data);
    setDepartmentsList(prev => prev.map(d => d.id === id ? updated : d));
    addToast('Department updated', 'success');
    return updated;
  };

  const deleteDepartment = async (id) => {
    await departmentService.delete(id);
    setDepartmentsList(prev => prev.filter(d => d.id !== id));
    addToast('Department deleted', 'warning');
  };

  // Lab Actions (Admin creates labs & assigns assistants)
  const addLab = async (data) => {
    const newLab = await labService.create(data);
    setLabsList(prev => [...prev, newLab]);
    addToast(`Laboratory "${newLab.name}" registered`, 'success');
    return newLab;
  };

  const updateLab = async (id, data) => {
    const updated = await labService.update(id, data);
    setLabsList(prev => prev.map(lab => lab.id === id ? updated : lab));
    addToast('Laboratory details updated', 'success');
    return updated;
  };

  const deleteLab = async (id) => {
    await labService.delete(id);
    setLabsList(prev => prev.filter(lab => lab.id !== id));
    addToast('Laboratory removed', 'warning');
  };

  const assignAssistantToLab = async (labId, assistantUserId, assistantName) => {
    const updatedLab = await labService.assignAssistant(labId, assistantUserId, assistantName);
    setLabsList(prev => prev.map(lab => lab.id === labId ? updatedLab : lab));

    // Update user's assignedLabIds
    const assistantUser = usersList.find(u => u.id === assistantUserId);
    if (assistantUser) {
      const currentLabs = assistantUser.assignedLabIds || [];
      const updatedLabs = currentLabs.includes(labId) ? currentLabs : [...currentLabs, labId];
      await userService.assignLabsToAssistant(assistantUserId, updatedLabs);
      setUsersList(prev => prev.map(u => u.id === assistantUserId ? { ...u, assignedLabIds: updatedLabs } : u));
    }

    addToast(`Assigned ${assistantName} to ${updatedLab.name}`, 'success');
    return updatedLab;
  };

  // Equipment Actions
  const addEquipment = async (data) => {
    const newItem = await equipmentService.create(data);
    setEquipmentList(prev => [newItem, ...prev]);

    // Admin receives equipment additions
    const notif = await notificationService.addNotification({
      title: 'New Hardware Model Added',
      message: `${newItem.name} (${newItem.quantity} unit${newItem.quantity > 1 ? 's' : ''}) registered in ${newItem.labName || 'Department Lab'}.`,
      type: 'info',
      category: 'equipment_addition',
      targetRoles: ['admin', 'assistant']
    });
    setNotificationsList(prev => [notif, ...prev]);

    addToast(`Equipment "${newItem.name}" (${newItem.quantity} unit${newItem.quantity > 1 ? 's' : ''}) registered with unique QR codes!`, 'success');
    return newItem;
  };

  const bulkAddEquipment = async (itemsList) => {
    const createdItems = await equipmentService.bulkCreate(itemsList);
    setEquipmentList(prev => [...createdItems, ...prev]);

    const totalUnits = createdItems.reduce((acc, i) => acc + (i.units ? i.units.length : i.quantity || 1), 0);

    // Admin receives bulk import notification
    const notif = await notificationService.addNotification({
      title: 'Bulk Equipment Import Completed',
      message: `Successfully imported ${createdItems.length} models (${totalUnits} total units) with generated QR codes.`,
      type: 'success',
      category: 'bulk_import',
      targetRoles: ['admin', 'assistant']
    });
    setNotificationsList(prev => [notif, ...prev]);

    addToast(`Successfully imported ${createdItems.length} equipment items with generated QR codes!`, 'success');
    return createdItems;
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

  // Club / Event Bulk Issue Action (Admin receives this notification)
  const issueEventAction = async (eventData) => {
    const { eventName, coordinator, totalQty, returnDate } = eventData;

    const notif = await notificationService.addNotification({
      title: `Club / Event Batch Issue: ${eventName}`,
      message: `${coordinator} checked out ${totalQty} units for university event. Return due: ${returnDate}.`,
      type: 'info',
      category: 'bulk_event_issue',
      targetRoles: ['admin', 'assistant', 'faculty']
    });
    setNotificationsList(prev => [notif, ...prev]);

    addToast(`Event equipment issue recorded for "${eventName}" (${totalQty} units)`, 'success');
    return notif;
  };

  // Redesigned Issue Equipment Action (Single unit - Admin is excluded from single issue alerts)
  const issueEquipmentAction = async (issueData) => {
    const { requestId, equipmentId, unitAssetId, borrowerName, borrowerId, borrowerRole, labId, labName, dueDate } = issueData;

    // 1. Create transaction
    const txn = await transactionService.issueEquipment({
      requestId,
      equipmentId,
      equipmentName: issueData.equipmentName,
      unitAssetId,
      borrowerName,
      borrowerId,
      borrowerRole,
      labId,
      labName,
      dueDate
    });
    setTransactionsList(prev => [txn, ...prev]);

    // 2. Mark equipment unit as 'Issued' and update available quantity
    const updatedEq = await equipmentService.updateUnitStatus(unitAssetId, 'Issued');
    if (updatedEq) {
      setEquipmentList(prev => prev.map(e => e.id === updatedEq.id ? updatedEq : e));
    }

    // 3. Update Request status to 'Issued' with unitAssetId link
    if (requestId) {
      const updatedReq = await requestService.updateRequestStatus(requestId, 'Issued', { unitAssetId });
      setRequestsList(prev => prev.map(r => r.id === requestId ? updatedReq : r));
    }

    // Single item checkout alert (Assistant & Student/Faculty only - NOT Admin)
    const notif = await notificationService.addNotification({
      title: 'Equipment Unit Handover Completed',
      message: `${issueData.equipmentName} (${unitAssetId}) issued to ${borrowerName}. Due: ${dueDate}.`,
      type: 'info',
      category: 'single_issue',
      targetRoles: ['assistant', 'student', 'faculty']
    });
    setNotificationsList(prev => [notif, ...prev]);

    addToast(`Successfully scanned & issued unit ${unitAssetId} to ${borrowerName}`, 'success');
    return txn;
  };

  // Return Equipment Action (Single return - Assistant & Borrower only)
  const returnEquipmentAction = async (transactionId, condition, remarks) => {
    const updatedTxn = await transactionService.returnEquipment(transactionId, condition, remarks);
    setTransactionsList(prev => prev.map(t => t.id === transactionId ? updatedTxn : t));

    if (updatedTxn) {
      // 1. Mark unit back to 'Available' with inspected condition
      if (updatedTxn.unitAssetId) {
        const updatedEq = await equipmentService.updateUnitStatus(updatedTxn.unitAssetId, 'Available', condition);
        if (updatedEq) {
          setEquipmentList(prev => prev.map(e => e.id === updatedEq.id ? updatedEq : e));
        }
      }

      // 2. Mark request as 'Returned'
      if (updatedTxn.requestId) {
        const updatedReq = await requestService.updateRequestStatus(updatedTxn.requestId, 'Returned');
        setRequestsList(prev => prev.map(r => r.id === updatedTxn.requestId ? updatedReq : r));
      }

      // Single item return alert
      const notif = await notificationService.addNotification({
        title: 'Equipment Unit Restocked',
        message: `${updatedTxn.equipmentName} (${updatedTxn.unitAssetId || transactionId}) returned by ${updatedTxn.borrowerName}. Condition: ${condition}.`,
        type: 'success',
        category: 'single_return',
        targetRoles: ['assistant', 'student', 'faculty']
      });
      setNotificationsList(prev => [notif, ...prev]);
    }

    addToast('Equipment successfully verified & returned to available inventory', 'success');
    return updatedTxn;
  };

  // Request Actions (Students/Faculty create, Assistant approves/rejects)
  const createRequestAction = async (data) => {
    const newReq = await requestService.createRequest(data);
    setRequestsList(prev => [newReq, ...prev]);

    const notif = await notificationService.addNotification({
      title: 'New Equipment Reservation Request',
      message: `${data.requesterName} submitted a request for ${data.equipmentName} (${data.labName}).`,
      type: 'info',
      category: 'single_request',
      targetRoles: ['assistant']
    });
    setNotificationsList(prev => [notif, ...prev]);

    addToast('Equipment reservation request submitted for Assistant review', 'success');
    return newReq;
  };

  const updateRequestStatusAction = async (id, status) => {
    const updated = await requestService.updateRequestStatus(id, status);
    setRequestsList(prev => prev.map(r => r.id === id ? updated : r));
    if (status === 'Approved') {
      addToast(`Request ${id} approved! Ready for borrower physical pickup & QR scan.`, 'success');
    } else {
      addToast(`Request ${id} marked as ${status}`, 'info');
    }
    return updated;
  };

  // Extension / Re-issue Flow (No QR scan needed - Assistant approves digitally)
  const requestExtensionAction = async (requestId, transactionId, newDueDate, reason) => {
    const updatedReq = await requestService.createExtensionRequest(requestId, newDueDate, reason);
    setRequestsList(prev => prev.map(r => r.id === requestId ? updatedReq : r));
    addToast('Extension request submitted to Lab Assistant for approval', 'success');
    return updatedReq;
  };

  const approveExtensionAction = async (requestId, transactionId, newDueDate) => {
    // 1. Update request status to Extended
    const updatedReq = await requestService.approveExtension(requestId);
    setRequestsList(prev => prev.map(r => r.id === requestId ? updatedReq : r));

    // 2. Extend transaction due date directly without QR scanning
    const targetDueDate = newDueDate || updatedReq.requiredUntil;
    if (transactionId) {
      const updatedTxn = await transactionService.extendDueDate(transactionId, targetDueDate);
      setTransactionsList(prev => prev.map(t => t.id === transactionId ? updatedTxn : t));
    }

    addToast(`Extension approved! Due date updated to ${targetDueDate}. No QR re-scan needed.`, 'success');
    return updatedReq;
  };

  // Inter-Lab Transfer Actions (Admin receives inter-lab transfer notices)
  const createTransferAction = async (data) => {
    const newTrf = await requestService.createTransfer(data);
    setTransfersList(prev => [newTrf, ...prev]);

    const notif = await notificationService.addNotification({
      title: 'Inter-Laboratory Transfer Initialized',
      message: `Transfer requested: ${data.equipmentName} from ${data.owningLab} to ${data.requestingLab}.`,
      type: 'info',
      category: 'inter_lab_transfer',
      targetRoles: ['admin', 'assistant', 'faculty']
    });
    setNotificationsList(prev => [notif, ...prev]);

    addToast('Inter-Lab Transfer request initialized', 'success');
    return newTrf;
  };

  const updateTransferStatusAction = async (id, status) => {
    const updated = await requestService.updateTransferStatus(id, status);
    setTransfersList(prev => prev.map(t => t.id === id ? updated : t));
    addToast(`Transfer ${id} updated to ${status}`, 'info');
  };

  // Notifications
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
        departmentsList,
        equipmentList,
        labsList,
        requestsList,
        transfersList,
        transactionsList,
        notificationsList,
        usersList,
        systemSettings,
        loading,
        refreshData,
        updateSystemSettingsAction,
        addUser,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        addLab,
        updateLab,
        deleteLab,
        assignAssistantToLab,
        addEquipment,
        bulkAddEquipment,
        updateEquipment,
        deleteEquipment,
        issueEventAction,
        issueEquipmentAction,
        returnEquipmentAction,
        createRequestAction,
        updateRequestStatusAction,
        requestExtensionAction,
        approveExtensionAction,
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
