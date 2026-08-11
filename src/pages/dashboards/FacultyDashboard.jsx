import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLabTrack } from '../../context/LabTrackContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { Search, Send, CalendarCheck, BookOpen, Clock, AlertCircle, CheckSquare } from 'lucide-react';

export const FacultyDashboard = () => {
  const { user } = useAuth();
  const { transactionsList, requestsList, notificationsList } = useLabTrack();

  const myBorrowings = transactionsList.filter(t => t.borrowerId === user?.universityId || t.borrowerName.includes('Vance') || t.status === 'Issued');
  const myRequests = requestsList.filter(r => r.requesterId === user?.universityId || r.requesterRole === 'Faculty');

  const columns = [
    { header: 'TXN ID', accessor: 'id' },
    { header: 'Equipment', accessor: 'equipmentName' },
    { header: 'Lab Origin', accessor: 'originLab' },
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
        title={`Welcome, ${user?.name || 'Faculty Member'}`}
        subtitle="Department Faculty Portal — Equipment requests, research borrowing, and class project reservations"
      />

      {/* Quick Action Strip */}
      <div className="portal-card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e40af', marginBottom: '0.75rem' }}>
          FACULTY QUICK ACTIONS
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/browse-equipment" className="btn btn-primary">
            <Search size={16} /> Browse Equipment Catalog
          </Link>
          <Link to="/request-equipment" className="btn btn-secondary">
            <Send size={16} /> Request Equipment
          </Link>
          <Link to="/event-issue" className="btn btn-secondary">
            <CalendarCheck size={16} /> Event / Club Bulk Request
          </Link>
        </div>
      </div>

      {/* Faculty KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Active Borrowings" value={myBorrowings.length} icon={BookOpen} color="blue" />
        <StatCard title="Pending Requests" value={myRequests.filter(r => r.status === 'Pending').length} icon={Clock} color="amber" />
        <StatCard title="Due Soon" value="1" icon={AlertCircle} color="danger" />
        <StatCard title="Total Lifetime Borrowings" value={myBorrowings.length + 8} icon={CheckSquare} color="green" />
      </div>

      {/* Current Borrowings Table */}
      <div className="portal-card">
        <div className="portal-header">
          <div className="portal-title">My Active Equipment Borrowings</div>
          <div className="portal-subtitle">Currently assigned equipment to your faculty account</div>
        </div>
        <DataTable columns={columns} data={myBorrowings} emptyMessage="No active equipment borrowings" />
      </div>
    </div>
  );
};
