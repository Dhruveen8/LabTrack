import { useAuth, useLabTrack } from '../../context/hooks';
import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { Search, Send, BookOpen, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { resolveUserDepartment } from '../../utils/userDepartment';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const { transactionsList, requestsList, departmentsList } = useLabTrack();

  // FIX: Filter strictly by the current user's numeric ID, not by hardcoded names or role.
  // Also separate ACTIVE borrowings from historical all-time borrowings.
  const myAllBorrowings = transactionsList.filter(t => t.borrowerId === user?.id);
  // FIX: "Currently Borrowed" means ACTIVE transactions only — not returned ones
  const myActiveBorrowings = myAllBorrowings.filter(
    t => t.status === 'Active' || t.status === 'ACTIVE'
  );
  const myRequests = requestsList.filter(r => r.requesterId === user?.id);
  const pendingRequests = myRequests.filter(r => r.status === 'Pending' || r.status === 'PENDING');

  // Due soon = active borrowings whose due date is within 3 days
  const dueSoonCount = myActiveBorrowings.filter(t => {
    const due = new Date(t.dueDate);
    const diffMs = due - Date.now();
    return diffMs > 0 && diffMs < 3 * 24 * 60 * 60 * 1000;
  }).length;

  const columns = [
    { header: 'TXN ID', accessor: 'id' },
    { header: 'Equipment Name', accessor: 'equipmentName' },
    { header: 'Issuing Lab', accessor: 'originLab' },
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
        title={`Student Portal — ${user?.name || 'Student'}`}
        subtitle={`University ID: ${user?.universityId || user?.id} | Department: ${resolveUserDepartment(user, departmentsList)}`}
      />

      {/* Quick Action Strip */}
      <div className="portal-card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e40af', marginBottom: '0.75rem' }}>
          STUDENT QUICK ACTIONS
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/browse-equipment" className="btn btn-primary">
            <Search size={16} /> Browse Lab Equipment Catalog
          </Link>
          <Link to="/request-equipment" className="btn btn-secondary">
            <Send size={16} /> Request Equipment for Project
          </Link>
        </div>
      </div>

      {/* Student KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Currently Borrowed" value={myActiveBorrowings.length} icon={BookOpen} color="blue" />
        <StatCard title="Pending Requests" value={pendingRequests.length} icon={Clock} color="amber" />
        {/* FIX: Real due-soon count, not hardcoded "1" */}
        <StatCard title="Due Soon" value={dueSoonCount} icon={AlertCircle} color="danger" />
        {/* FIX: Total lifetime borrowings without fabricated offset */}
        <StatCard title="Total Borrowings" value={myAllBorrowings.length} icon={CheckCircle2} color="green" />
      </div>

      {/* Current Borrowings Table — show ACTIVE only */}
      <div className="portal-card">
        <div className="portal-header">
          <div className="portal-title">My Current Borrowings</div>
          <div className="portal-subtitle">Items currently checked out to your university ID</div>
        </div>
        <DataTable columns={columns} data={myActiveBorrowings} emptyMessage="You have no active equipment borrowings" />
      </div>
    </div>
  );
};
