import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { RefreshCw, QrCode, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const TransactionsListPage = () => {
  const { user } = useAuth();
  const { transactionsList } = useLabTrack();

  const isStudentOrFaculty = user?.role === 'student' || user?.role === 'faculty';
  const isAssistant = user?.role === 'assistant';

  let visibleTxns = transactionsList;
  if (isStudentOrFaculty) {
    visibleTxns = transactionsList.filter(
      t => t.borrowerId === user.universityId || t.borrowerName === user.name
    );
  } else if (isAssistant && user?.assignedLabIds?.length > 0) {
    visibleTxns = transactionsList.filter(t => user.assignedLabIds.includes(t.labId));
  }

  const columns = [
    {
      header: 'Txn ID',
      accessor: 'id',
      cell: (row) => (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e40af' }}>
          {row.id}
        </span>
      )
    },
    {
      header: 'Asset QR Tag',
      accessor: 'unitAssetId',
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>
            {row.unitAssetId || row.equipmentId}
          </span>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.equipmentName}</div>
        </div>
      )
    },
    {
      header: 'Borrower',
      accessor: 'borrowerName',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.borrowerName}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.borrowerId} ({row.borrowerType})</div>
        </div>
      )
    },
    { header: 'Origin Lab', accessor: 'originLab' },
    { header: 'Issue Date', accessor: 'issueDate' },
    {
      header: 'Due / Return Date',
      cell: (row) => (
        <div>
          <div style={{ fontSize: '0.85rem', color: row.status === 'Overdue' ? '#dc2626' : '#0f172a', fontWeight: 600 }}>
            Due: {row.dueDate}
          </div>
          {row.returnDate && (
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
              Returned: {row.returnDate}
            </div>
          )}
          {row.reissuedCount > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#2563eb' }}>
              Extended {row.reissuedCount} time{row.reissuedCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {/* Extension action for borrower if item is active */}
          {isStudentOrFaculty && (row.status === 'Issued' || row.status === 'Overdue') && (
            <Link to={`/extend-request/${row.id}`} className="btn btn-secondary btn-sm">
              <RefreshCw size={13} /> Extend
            </Link>
          )}

          {/* Quick return button for assistant */}
          {isAssistant && (row.status === 'Issued' || row.status === 'Overdue') && (
            <Link to="/return-equipment" className="btn btn-secondary btn-sm">
              <QrCode size={13} /> Scan Return
            </Link>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Equipment Transaction Audit & Checkout History"
        subtitle={
          isStudentOrFaculty
            ? "Your active laboratory borrowings and return logs"
            : "Complete university equipment circulation and checkout transaction logs"
        }
      />

      <div className="portal-card">
        <DataTable columns={columns} data={visibleTxns} />
      </div>
    </div>
  );
};
