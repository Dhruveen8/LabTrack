import React from 'react';
import { useLabTrack } from '../../context/LabTrackContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { Package, CheckCircle, Clock, AlertTriangle, FileSpreadsheet, Building2, Users, BarChart, ArrowRight, BrainCircuit } from 'lucide-react';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export const AdminDashboard = () => {
  const { equipmentList, labsList, departmentsList, transactionsList, requestsList } = useLabTrack();

  const totalEquipment = equipmentList.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 0), 0);
  const available = equipmentList.reduce((acc, item) => acc + (parseInt(item.availableQuantity, 10) || 0), 0);
  const borrowed = equipmentList.reduce((acc, item) => acc + (parseInt(item.borrowedQuantity, 10) || 0), 0);
  const overdueCount = transactionsList.filter(t => t.status === 'Overdue').length;
  const pendingReqs = requestsList.filter(r => r.status === 'Pending').length;

  // Chart Data
  const labChartData = labsList.map(lab => ({
    name: lab.name.replace('Lab', '').trim(),
    Available: lab.available,
    Borrowed: lab.borrowed,
    Maintenance: lab.maintenance || 0
  }));

  const pieData = [
    { name: 'Available', value: available, color: '#15803d' },
    { name: 'Borrowed', value: borrowed, color: '#1e40af' },
    { name: 'Overdue', value: overdueCount, color: '#b91c1c' }
  ];

  const transactionColumns = [
    {
      header: 'TXN ID',
      accessor: 'id',
      cell: (row) => <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.id}</span>
    },
    {
      header: 'Asset & Model',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.equipmentName}</div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#1e40af' }}>{row.unitAssetId || row.equipmentId}</div>
        </div>
      )
    },
    { header: 'Borrower', accessor: 'borrowerName' },
    { header: 'Lab', accessor: 'originLab' },
    { header: 'Due Date', accessor: 'dueDate' },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div>
      <PageHeader
        title="University Laboratory System Administration"
        subtitle="Institution-wide department oversight, facility management, and asset utilization analytics"
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/labs" className="btn btn-primary btn-sm">
              <Building2 size={14} /> Manage Laboratories ({labsList.length})
            </Link>
            <Link to="/users" className="btn btn-secondary btn-sm">
              <Users size={14} /> Assign Assistants
            </Link>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Total Registered Units" value={totalEquipment} icon={Package} color="blue" subtext={`Across ${labsList.length} laboratories`} />
        <StatCard title="Available in Labs" value={available} icon={CheckCircle} color="green" subtext="Ready for checkout" />
        <StatCard title="Currently Issued" value={borrowed} icon={Clock} color="purple" subtext="In active circulation" />
        <StatCard title="Overdue Items" value={overdueCount} icon={AlertTriangle} color="danger" subtext="Follow-up required" />
        <StatCard title="Active Laboratories" value={labsList.length} icon={Building2} color="blue" subtext={`In ${departmentsList.length} departments`} />
        <StatCard title="Pending Requests" value={pendingReqs} icon={FileSpreadsheet} color="warning" subtext="Delegated to Assistants" />
      </div>

      {/* Analytics Visualizations Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Lab-wise Distribution Bar Chart */}
        <div className="portal-card" style={{ marginBottom: 0 }}>
          <div className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="portal-title">Department Laboratory Equipment Distribution</div>
              <div className="portal-subtitle">Comparison of inventory states across facilities</div>
            </div>
            <BarChart size={18} style={{ color: '#64748b' }} />
          </div>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={labChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="Available" fill="#15803d" />
                <Bar dataKey="Borrowed" fill="#1e40af" />
                <Bar dataKey="Maintenance" fill="#b45309" />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Inventory Proportion Pie Chart */}
        <div className="portal-card" style={{ marginBottom: 0 }}>
          <div className="portal-header">
            <div className="portal-title">Campus Asset Allocation</div>
            <div className="portal-subtitle">Live status proportions</div>
          </div>
          <div style={{ width: '100%', height: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="portal-card">
        <div className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="portal-title">Recent Equipment Transactions</div>
            <div className="portal-subtitle">Campus-wide circulation and issue records</div>
          </div>
          <Link to="/transactions" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            View All Transactions <ArrowRight size={14} />
          </Link>
        </div>
        <DataTable columns={transactionColumns} data={transactionsList.slice(0, 5)} />
      </div>
    </div>
  );
};
