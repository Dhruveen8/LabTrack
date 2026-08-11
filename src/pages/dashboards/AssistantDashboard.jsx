import React from 'react';
import { useLabTrack } from '../../context/LabTrackContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { QrCode, History, Plus, Upload, CheckCircle, Clock, AlertTriangle, FileText } from 'lucide-react';

export const AssistantDashboard = () => {
  const { equipmentList, transactionsList, requestsList } = useLabTrack();

  const available = equipmentList.reduce((acc, item) => acc + (parseInt(item.availableQuantity, 10) || 0), 0);
  const borrowed = equipmentList.reduce((acc, item) => acc + (parseInt(item.borrowedQuantity, 10) || 0), 0);
  const overdue = transactionsList.filter(t => t.status === 'Overdue').length;
  const pendingRequests = requestsList.filter(r => r.status === 'Pending').length;

  const columns = [
    { header: 'TXN ID', accessor: 'id' },
    { header: 'Equipment', accessor: 'equipmentName' },
    { header: 'Borrower', accessor: 'borrowerName' },
    { header: 'Issue Date', accessor: 'issueDate' },
    { header: 'Due Date', accessor: 'dueDate' },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div>
      <PageHeader
        title="Lab Assistant Workspace"
        subtitle="Manage daily laboratory counter operations, issue items, process returns, and update inventory"
      />

      {/* Quick Operations Strip */}
      <div className="portal-card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e40af', marginBottom: '0.75rem' }}>
          QUICK DESK OPERATIONS
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/issue-equipment" className="btn btn-primary">
            <QrCode size={16} /> Issue Equipment
          </Link>
          <Link to="/return-equipment" className="btn btn-secondary">
            <History size={16} /> Return Equipment
          </Link>
          <Link to="/equipment/add" className="btn btn-secondary">
            <Plus size={16} /> Add Equipment
          </Link>
          <Link to="/bulk-import" className="btn btn-secondary">
            <Upload size={16} /> Bulk Import CSV
          </Link>
        </div>
      </div>

      {/* Counter Statistics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Available Equipment" value={available} icon={CheckCircle} color="green" />
        <StatCard title="Currently Borrowed" value={borrowed} icon={Clock} color="blue" />
        <StatCard title="Today's Issues" value="14" icon={QrCode} color="purple" />
        <StatCard title="Today's Returns" value="9" icon={History} color="blue" />
        <StatCard title="Pending Requests" value={pendingRequests} icon={FileText} color="amber" />
        <StatCard title="Overdue Items" value={overdue} icon={AlertTriangle} color="danger" />
      </div>

      {/* Desk Recent Activity Table */}
      <div className="portal-card">
        <div className="portal-header">
          <div className="portal-title">Today's Counter Activity</div>
          <div className="portal-subtitle">Recent borrowing transactions processed at this lab counter</div>
        </div>
        <DataTable columns={columns} data={transactionsList.slice(0, 6)} />
      </div>
    </div>
  );
};
