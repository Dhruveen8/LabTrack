import { useLabTrack, useAuth } from '../../context/hooks';
import { formatDate } from '../../utils/dateFormat';
import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CheckCircle, XCircle } from 'lucide-react';

export const InterLabTransfersPage = () => {
  const { user } = useAuth();
  const { transfersList, updateTransferStatusAction } = useLabTrack();

  const columns = [
    { header: 'Transfer ID', accessor: 'id' },
    { header: 'Source Lab', accessor: 'fromLabName' },
    { header: 'Destination Lab', accessor: 'toLabName' },
    { header: 'Requested By', accessor: 'requesterName' },
    { header: 'Reason', accessor: 'reason' },
    { header: 'Request Date', cell: (row) => formatDate(row.requestDate) },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {user?.role === 'admin' && row.status === 'Pending' && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => updateTransferStatusAction(row.id, 'Approved')}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => updateTransferStatusAction(row.id, 'Rejected')}>
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {(user?.role === 'admin' || (user?.role === 'assistant' && user?.assignedLabIds?.includes(row.toLabId))) && row.status === 'Approved' && (
            <button className="btn btn-success btn-sm" onClick={() => updateTransferStatusAction(row.id, 'Completed')}>
              <CheckCircle size={14} /> Complete
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Inter-Lab Equipment Transfers" subtitle="Coordinate temporary hardware borrowing and transfers across department laboratories" />
      <div className="portal-card">
        <DataTable columns={columns} data={transfersList} />
      </div>
    </div>
  );
};
