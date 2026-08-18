import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Send, CheckCircle, XCircle, RefreshCw, QrCode, Clock, Sparkles } from 'lucide-react';

export const RequestsListPage = () => {
  const { user } = useAuth();
  const { requestsList, transactionsList, updateRequestStatusAction, approveExtensionAction } = useLabTrack();
  const [filterStatus, setFilterStatus] = useState('ALL');

  const isAssistant = user?.role === 'assistant';
  const assignedLabIds = user?.assignedLabIds || [];

  // Filter requests based on role
  let visibleRequests = requestsList;
  if (isAssistant && assignedLabIds.length > 0) {
    visibleRequests = requestsList.filter(r => assignedLabIds.includes(r.labId));
  } else if (user?.role === 'student' || user?.role === 'faculty') {
    visibleRequests = requestsList.filter(r => r.requesterId === user.universityId || r.requesterName === user.name);
  }

  // Apply tab filter
  if (filterStatus !== 'ALL') {
    visibleRequests = visibleRequests.filter(r => r.status?.toLowerCase() === filterStatus.toLowerCase());
  }

  const handleApprove = async (row) => {
    await updateRequestStatusAction(row.id, 'Approved');
  };

  const handleReject = async (row) => {
    await updateRequestStatusAction(row.id, 'Rejected');
  };

  const handleApproveExtension = async (row) => {
    const txn = transactionsList.find(t => t.requestId === row.id || t.equipmentId === row.equipmentId);
    await approveExtensionAction(row.id, txn?.id, row.requestedNewDueDate);
  };

  const columns = [
    {
      header: 'Request ID',
      accessor: 'id',
      cell: (row) => (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e40af' }}>
          {row.id}
        </span>
      )
    },
    {
      header: 'Requester',
      accessor: 'requesterName',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.requesterName}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.requesterId} ({row.requesterRole})</div>
        </div>
      )
    },
    {
      header: 'Equipment',
      accessor: 'equipmentName',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.equipmentName}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.labName} (Qty: {row.quantity || 1})</div>
        </div>
      )
    },
    {
      header: 'Required Dates',
      accessor: 'requiredUntil',
      cell: (row) => (
        <div>
          <div style={{ fontSize: '0.85rem', color: '#334155' }}>
            {row.requiredFrom} ➔ <strong>{row.requiredUntil}</strong>
          </div>
          {row.status === 'Extension_Pending' && (
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
              Extension Requested to: {row.requestedNewDueDate}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => {
        if (row.status === 'Approved') {
          return (
            <div>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={12} /> Approved
              </span>
              <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                Ready for QR Pickup
              </div>
            </div>
          );
        }
        if (row.status === 'Extension_Pending') {
          return (
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={12} /> Extension Pending
            </span>
          );
        }
        if (row.status === 'Issued') {
          return (
            <div>
              <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <QrCode size={12} /> Issued (In Use)
              </span>
              {row.unitAssetId && (
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#1e40af' }}>
                  {row.unitAssetId}
                </div>
              )}
            </div>
          );
        }
        if (row.status === 'Returned') {
          return <span className="badge badge-neutral">Returned</span>;
        }
        return <StatusBadge status={row.status} />;
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {/* ONLY Assistant has the right to approve requests */}
          {isAssistant && row.status === 'Pending' && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleApprove(row)}
                title="Approve for physical pickup"
              >
                <CheckCircle size={13} /> Approve
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleReject(row)}
              >
                <XCircle size={13} /> Reject
              </button>
            </>
          )}

          {/* Assistant approval for digital extension */}
          {isAssistant && row.status === 'Extension_Pending' && (
            <button
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: '#15803d', borderColor: '#15803d' }}
              onClick={() => handleApproveExtension(row)}
            >
              <CheckCircle size={13} /> Approve Extension
            </button>
          )}

          {/* Quick link to counter if approved */}
          {isAssistant && row.status === 'Approved' && (
            <Link to="/issue-equipment" className="btn btn-secondary btn-sm">
              <QrCode size={13} /> Go to Counter
            </Link>
          )}

          {/* Borrower action: request extension if already issued */}
          {(user?.role === 'student' || user?.role === 'faculty') && row.status === 'Issued' && (
            <Link to={`/extend-request/${row.id}`} className="btn btn-secondary btn-sm">
              <RefreshCw size={13} /> Request Extension
            </Link>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Laboratory Equipment Borrowing Requests"
        subtitle={
          isAssistant
            ? "Review and approve student and faculty checkout requests for your assigned laboratories"
            : "Track your submitted reservation requests and pickup approvals"
        }
        actions={
          (user?.role === 'student' || user?.role === 'faculty') && (
            <Link to="/request-equipment" className="btn btn-primary">
              <Send size={14} /> Submit New Request
            </Link>
          )
        }
      />

      {/* Role explanation alert for Admin */}
      {user?.role === 'admin' && (
        <div className="portal-card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginBottom: '1rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>
            <strong>Admin View Only:</strong> Equipment checkout approvals are delegated exclusively to Lab Assistants managing each laboratory. Admin manages laboratory assignments and department resources.
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'Pending', 'Approved', 'Extension_Pending', 'Issued', 'Returned', 'Rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="portal-card">
        <DataTable columns={columns} data={visibleRequests} />
      </div>
    </div>
  );
};
