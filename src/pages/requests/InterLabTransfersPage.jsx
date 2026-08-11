import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowRightLeft, CheckCircle, XCircle } from 'lucide-react';

export const InterLabTransfersPage = () => {
  const { user } = useAuth();
  const { transfersList, updateTransferStatusAction } = useLabTrack();

  const columns = [
    { header: 'Transfer ID', accessor: 'id' },
    { header: 'Requesting Lab', accessor: 'requestingLab' },
    { header: 'Owning Lab', accessor: 'owningLab' },
    { header: 'Equipment', accessor: 'equipmentName' },
    { header: 'Requested By', accessor: 'requestedBy' },
    { header: 'Required Dates', cell: (row) => `${row.requiredFrom} to ${row.requiredUntil}` },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {(user?.role === 'admin' || user?.role === 'assistant') && row.status === 'Pending' && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => updateTransferStatusAction(row.id, 'Approved')}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => updateTransferStatusAction(row.id, 'Rejected')}>
                <XCircle size={14} /> Reject
              </button>
            </>
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
