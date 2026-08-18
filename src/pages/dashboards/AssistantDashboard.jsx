import React from 'react';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { QrCode, History, Plus, Upload, CheckCircle, Clock, AlertTriangle, FileText, Building2, Send } from 'lucide-react';

export const AssistantDashboard = () => {
  const { user } = useAuth();
  const { equipmentList, transactionsList, requestsList, labsList } = useLabTrack();

  const assignedLabIds = user?.assignedLabIds || [];
  const assignedLabs = labsList.filter(l => assignedLabIds.includes(l.id));

  // Filter equipment & transactions by assigned labs
  const myEquipment = assignedLabIds.length > 0
    ? equipmentList.filter(e => assignedLabIds.includes(e.labId))
    : equipmentList;

  const myTransactions = assignedLabIds.length > 0
    ? transactionsList.filter(t => assignedLabIds.includes(t.labId))
    : transactionsList;

  const myRequests = assignedLabIds.length > 0
    ? requestsList.filter(r => assignedLabIds.includes(r.labId))
    : requestsList;

  const available = myEquipment.reduce((acc, item) => acc + (parseInt(item.availableQuantity, 10) || 0), 0);
  const borrowed = myEquipment.reduce((acc, item) => acc + (parseInt(item.borrowedQuantity, 10) || 0), 0);
  const overdue = myTransactions.filter(t => t.status === 'Overdue').length;
  const pendingRequests = myRequests.filter(r => r.status === 'Pending').length;
  const readyPickupRequests = myRequests.filter(r => r.status === 'Approved').length;

  const columns = [
    {
      header: 'TXN ID',
      accessor: 'id',
      cell: (row) => <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.id}</span>
    },
    {
      header: 'Equipment & Unit',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.equipmentName}</div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#1e40af' }}>{row.unitAssetId}</div>
        </div>
      )
    },
    { header: 'Borrower', accessor: 'borrowerName' },
    { header: 'Origin Lab', accessor: 'originLab' },
    { header: 'Due Date', accessor: 'dueDate' },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div>
      <PageHeader
        title={`Lab Assistant Workspace — ${user?.name || 'Marcus Brody'}`}
        subtitle="Manage daily laboratory counter operations, approve checkout applications, and scan physical QR asset labels"
      />

      {/* Assigned Labs Badge Bar */}
      <div className="portal-card" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              YOUR ASSIGNED DEPARTMENT LABORATORIES ({assignedLabs.length})
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '6px', flexWrap: 'wrap' }}>
              {assignedLabs.map(lab => (
                <span
                  key={lab.id}
                  className="badge badge-info"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Building2 size={13} /> {lab.name} ({lab.id})
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#166534' }}>
            Department: <strong>{user?.department || 'Electrical & Electronics'}</strong>
          </div>
        </div>
      </div>

      {/* Quick Operations Strip */}
      <div className="portal-card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e40af', marginBottom: '0.75rem' }}>
          COUNTER DESK OPERATIONS
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/issue-equipment" className="btn btn-primary">
            <QrCode size={16} /> Scan & Issue Equipment
          </Link>
          <Link to="/return-equipment" className="btn btn-secondary">
            <History size={16} /> Scan & Return Equipment
          </Link>
          <Link to="/requests" className="btn btn-secondary">
            <FileText size={16} /> Review Requests ({pendingRequests} Pending)
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
        <StatCard title="Available Units" value={available} icon={CheckCircle} color="green" />
        <StatCard title="Currently Borrowed" value={borrowed} icon={Clock} color="blue" />
        <StatCard title="Pending Approvals" value={pendingRequests} icon={FileText} color="amber" />
        <StatCard title="Awaiting QR Pickup" value={readyPickupRequests} icon={QrCode} color="purple" />
        <StatCard title="Overdue Items" value={overdue} icon={AlertTriangle} color="danger" />
      </div>

      {/* Desk Recent Activity Table */}
      <div className="portal-card">
        <div className="portal-header">
          <div className="portal-title">Recent Laboratory Checkout & Return Activity</div>
          <div className="portal-subtitle">Live circulation log for your managed laboratories</div>
        </div>
        <DataTable columns={columns} data={myTransactions.slice(0, 6)} />
      </div>
    </div>
  );
};
