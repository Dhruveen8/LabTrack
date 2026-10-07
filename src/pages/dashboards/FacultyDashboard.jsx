import { useAuth, useLabTrack } from '../../context/hooks';
import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { Search, Send, CalendarCheck, BookOpen, Clock, AlertCircle, CheckSquare, Zap } from 'lucide-react';

export const FacultyDashboard = () => {
  const { user } = useAuth();
  const { transactionsList, requestsList } = useLabTrack();

  // FIX: Filter strictly by current user's numeric ID, not by hardcoded names or role
  const myAllBorrowings = transactionsList.filter(t => t.borrowerId === user?.id);
  // FIX: "Active Borrowings" = ACTIVE status only, not all transactions including returned
  const myActiveBorrowings = myAllBorrowings.filter(
    t => t.status === 'Active' || t.status === 'ACTIVE'
  );
  const myRequests = requestsList.filter(r => r.requesterId === user?.id);
  const pendingRequests = myRequests.filter(r => r.status === 'Pending' || r.status === 'PENDING');

  // Due soon = active borrowings whose due date is within 5 days for faculty
  const dueSoonCount = myActiveBorrowings.filter(t => {
    const due = new Date(t.dueDate);
    const diffMs = due - Date.now();
    return diffMs > 0 && diffMs < 5 * 24 * 60 * 60 * 1000;
  }).length;

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
          <Link to="/quick-borrow" className="btn btn-secondary">
            <Zap size={16} /> Quick Borrow Counter
          </Link>
        </div>
      </div>

      {/* Faculty KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Active Borrowings" value={myActiveBorrowings.length} icon={BookOpen} color="blue" />
        <StatCard title="Pending Requests" value={pendingRequests.length} icon={Clock} color="amber" />
        {/* FIX: Real due-soon count, not hardcoded "1" */}
        <StatCard title="Due Soon" value={dueSoonCount} icon={AlertCircle} color="danger" />
        {/* FIX: Total lifetime borrowings without fabricated +8 offset */}
        <StatCard title="Total Lifetime Borrowings" value={myAllBorrowings.length} icon={CheckSquare} color="green" />
      </div>

      {/* Active Borrowings Table — ACTIVE only */}
      <div className="portal-card">
        <div className="portal-header">
          <div className="portal-title">My Active Equipment Borrowings</div>
          <div className="portal-subtitle">Currently assigned equipment to your faculty account</div>
        </div>
        <DataTable columns={columns} data={myActiveBorrowings} emptyMessage="No active equipment borrowings" />
      </div>
    </div>
  );
};
