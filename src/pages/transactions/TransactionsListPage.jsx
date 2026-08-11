import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SearchBar } from '../../components/common/SearchBar';
import { useLabTrack } from '../../context/LabTrackContext';

export const TransactionsListPage = () => {
  const { transactionsList } = useLabTrack();
  const [search, setSearch] = useState('');

  const filtered = transactionsList.filter(t =>
    t.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
    t.borrowerName.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: 'Transaction ID', accessor: 'id' },
    { header: 'Equipment Name', accessor: 'equipmentName' },
    { header: 'Borrower', accessor: 'borrowerName' },
    { header: 'Role', accessor: 'borrowerType' },
    { header: 'Origin Lab', accessor: 'originLab' },
    { header: 'Issue Date', accessor: 'issueDate' },
    { header: 'Due Date', accessor: 'dueDate' },
    { header: 'Return Date', cell: (row) => row.returnDate || '—' },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div>
      <PageHeader title="Transaction History Audit Log" subtitle="Complete record of all equipment checkouts, returns, transfers, and overdue items" />
      <div className="portal-card">
        <div style={{ marginBottom: '1rem' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search transaction ID, equipment, borrower..." />
        </div>
        <DataTable columns={columns} data={filtered} />
      </div>
    </div>
  );
};
