import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Send, CheckCircle, XCircle } from 'lucide-react';

export const RequestsListPage = () => {
  const { user } = useAuth();
  const { requestsList, updateRequestStatusAction } = useLabTrack();

  const columns = [
    { header: 'Request ID', accessor: 'id' },
    { header: 'Requester', accessor: 'requesterName' },
    { header: 'Equipment', accessor: 'equipmentName' },
    { header: 'Target Lab', accessor: 'labName' },
    { header: 'Required From', accessor: 'requiredFrom' },
    { header: 'Required Until', accessor: 'requiredUntil' },
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
              <button
                className="btn btn-primary btn-sm"
                onClick={() => updateRequestStatusAction(row.id, 'Approved')}
              >
                <CheckCircle size={14} /> Approve
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => updateRequestStatusAction(row.id, 'Rejected')}
              >
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
      <PageHeader
        title="Equipment Borrowing Requests"
        subtitle="Manage pending and past equipment checkout approvals across student and faculty applications"
        actions={
          <Link to="/request-equipment" className="btn btn-primary">
            <Send size={14} /> Submit New Request
          </Link>
        }
      />
      <div className="portal-card">
        <DataTable columns={columns} data={requestsList} />
      </div>
    </div>
  );
};
