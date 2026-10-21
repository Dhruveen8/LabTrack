import { useLabTrack, useAuth, useToast } from '../../context/hooks';
import { formatDate } from '../../utils/dateFormat';
import React, { useState } from 'react';
import { requestHasLab, requestHasStage, cartError } from '../../utils/cart';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ApprovalQueue } from '../../components/common/ApprovalQueue';
import { RequestTrackingButton } from '../../components/common/RequestTrackingButton';
import apiClient from '../../api/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { approvalQueue } from '../../utils/approvalQueue';
import { Send, CheckCircle, XCircle, RefreshCw, QrCode, Sparkles, ClipboardCheck, ListFilter } from 'lucide-react';
import './RequestsListPage.css';

export const RequestsListPage = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { requestsList, transactionsList, updateRequestStatusAction, approveExtensionAction, refreshData } = useLabTrack();
  const [filterStatus, setFilterStatus] = useState('ALL');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isReviewer = user?.role === 'faculty';
  const reviewing = isReviewer && searchParams.get('view') !== 'all';
  const pendingApprovals = approvalQueue(requestsList, user).length;

  const isAssistant = user?.role === 'assistant';
  const assignedLabIds = user?.assignedLabIds || [];

  // Filter requests based on role
  let visibleRequests = requestsList;
  if (isAssistant && assignedLabIds.length > 0) {
    visibleRequests = requestsList.filter(r => requestHasLab(r, assignedLabIds));
  } else if (user?.role === 'student') {
    visibleRequests = requestsList.filter(r => r.requesterId === user.id || r.requesterName === user.name);
  }

  // Apply tab filter
  if (filterStatus !== 'ALL') {
    visibleRequests = visibleRequests.filter(r => requestHasStage(r, filterStatus.toUpperCase(), isAssistant ? assignedLabIds : undefined));
  }

  const handleApprove = async (row) => {
    try { await updateRequestStatusAction(row.id, 'Approved'); return true; } catch (error) { addToast(cartError(error), 'error'); return false; }
  };

  const handleReject = async (row) => {
    try { await updateRequestStatusAction(row.id, 'Rejected'); } catch (error) { addToast(cartError(error), 'error'); }
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
          {row.items?.length ? row.items.map(item => <div key={item.id} style={{ marginBottom: '8px' }}>
            <strong>{item.equipment_name} × {item.quantity}</strong>
            <div style={{ fontSize: '.75rem', color: '#64748b' }}>{item.lab_name} · {item.status} · {item.issued_quantity} issued / {item.returned_quantity} returned</div>
            {item.collection_deadline && <div>Collect by: {formatDate(item.collection_deadline)}</div>}
          </div>) : <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.equipmentName}</div>}
          {row.kind === 'QUICK_BORROW' && <span className="badge badge-warning">Quick Borrow · Same-day return</span>}
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.labName} (Qty: {row.quantity || 1})</div>
          {row.rejectionReason && <div>Reason: {row.rejectionReason}</div>}
        </div>
      )
    },
    {
      header: 'Required Dates',
      accessor: 'requiredUntil',
      cell: (row) => (
        <div>
          <div style={{ fontSize: '0.85rem', color: '#334155' }}>
            {formatDate(row.requiredFrom)} ➔ <strong>{formatDate(row.requiredUntil)}</strong>
          </div>
          {row.status === 'Extension_Pending' && (
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
              Extension Requested to: {formatDate(row.requestedNewDueDate)}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => {
        if (row.items?.length) return <RequestTrackingButton request={row} />;
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
        <div className="requests-page__actions">
          {row.requesterId === user.id && row.items?.some(item => ['PENDING', 'APPROVED'].includes(item.status)) &&
            <button type="button" className="btn btn-secondary" onClick={async () => {
              try { await apiClient.post(`/borrowing/requests/${row.id}/cancel`); await refreshData(); }
              catch (error) { addToast(cartError(error), 'error'); }
            }}><XCircle size={16} aria-hidden="true" />Cancel unissued items</button>}
          {/* ONLY Assistant has the right to approve requests */}
          {isAssistant && row.items?.some(item => item.status === 'PENDING' && item.approval_stage === 'ASSISTANT' && assignedLabIds.includes(item.lab_id)) && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleApprove(row)}
                title="Approve for physical pickup"
              >
                <CheckCircle size={16} aria-hidden="true" /> Approve
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (!await handleApprove(row)) return;
                  navigate(`/issue-equipment?autoRequestId=${row.id}`);
                }}
                title="Approve and immediately go to checkout counter"
              >
                <Sparkles size={16} aria-hidden="true" /> Approve & Issue Now
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleReject(row)}
              >
                <XCircle size={16} aria-hidden="true" /> Reject
              </button>
            </>
          )}

          {/* Assistant approval for digital extension */}
          {isAssistant && row.status === 'Extension_Pending' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleApproveExtension(row)}
            >
              <CheckCircle size={16} aria-hidden="true" /> Approve Extension
            </button>
          )}

          {/* Quick link to counter if approved */}
          {isAssistant && requestHasStage(row, 'APPROVED', assignedLabIds) && (
            <Link to="/issue-equipment" className="btn btn-secondary">
              <QrCode size={16} aria-hidden="true" /> Go to Counter
            </Link>
          )}

          {/* Borrower action: request extension if already issued */}
          {(user?.role === 'student' || user?.role === 'faculty') && row.status === 'Issued' && row.kind !== 'QUICK_BORROW' && (
            <Link to={`/extend-request/${row.id}`} className="btn btn-secondary">
              <RefreshCw size={16} aria-hidden="true" /> Request Extension
            </Link>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="requests-page">
      <PageHeader
        title="Laboratory Equipment Borrowing Requests"
        subtitle={
          isAssistant
            ? "Review and approve student and faculty checkout requests for your assigned laboratories"
            : isReviewer ? "Review requests awaiting your approval, or view all requests and their progress"
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
      {isReviewer && <div className="requests-page__view-switch" role="group" aria-label="Request view">
        <button type="button" className={`btn ${reviewing ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={reviewing}
          onClick={() => setSearchParams({ view: 'approvals' })}><ClipboardCheck size={16} aria-hidden="true" />Awaiting my approval <span className="requests-page__count">{pendingApprovals}</span></button>
        <button type="button" className={`btn ${!reviewing ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={!reviewing}
          onClick={() => setSearchParams({ view: 'all' })}><ListFilter size={16} aria-hidden="true" />All requests</button>
      </div>}
      {reviewing && <ApprovalQueue />}

      {/* Role explanation alert for Admin */}
      {user?.role === 'admin' && (
        <div className="portal-card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginBottom: '1rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>
            <strong>Admin View:</strong> Faculty and HODs review academic approvals. Assigned lab assistants approve fulfillment and issue equipment.
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {!reviewing && <div className="requests-page__filters" role="group" aria-label="Filter requests by status">
        {['ALL', 'Pending', 'Approved', 'Extension_Pending', 'Issued', 'Returned', 'Rejected', 'Cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            type="button"
            className={`btn ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={filterStatus === status}
          >
            {status === 'ALL' ? 'All statuses' : status.replace('_', ' ')}
          </button>
        ))}
      </div>}

      {!reviewing && <div className="portal-card">
        <DataTable columns={columns} data={visibleRequests} />
      </div>}
    </div>
  );
};
