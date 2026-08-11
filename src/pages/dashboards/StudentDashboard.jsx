import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLabTrack } from '../../context/LabTrackContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { Search, Send, BookOpen, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const { transactionsList, requestsList } = useLabTrack();

  const myBorrowings = transactionsList.filter(t => t.borrowerId === user?.universityId || t.borrowerName.includes('Alex') || t.status === 'Issued');
  const myRequests = requestsList.filter(r => r.requesterId === user?.universityId || r.requesterRole === 'Student');

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
        title={`Student Portal - ${user?.name || 'Alex Johnson'}`}
        subtitle={`University ID: ${user?.universityId || 'STU-2024-884'} | Department: ${user?.department || 'Computer Science'}`}
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
        <StatCard title="Currently Borrowed" value={myBorrowings.length} icon={BookOpen} color="blue" />
        <StatCard title="Pending Requests" value={myRequests.filter(r => r.status === 'Pending').length} icon={Clock} color="amber" />
        <StatCard title="Due Soon" value="1" icon={AlertCircle} color="danger" />
        <StatCard title="Total Borrowings" value={myBorrowings.length + 3} icon={CheckCircle2} color="green" />
      </div>

      {/* Current Borrowings Table */}
      <div className="portal-card">
        <div className="portal-header">
          <div className="portal-title">My Current Borrowings</div>
          <div className="portal-subtitle">Items currently checked out to your university ID</div>
        </div>
        <DataTable columns={columns} data={myBorrowings} emptyMessage="You have no active equipment borrowings" />
      </div>
    </div>
  );
};
