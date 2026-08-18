import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useLabTrack } from '../../context/LabTrackContext';
import { Building2, Shield, User, UserPlus, X, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const UserManagementPage = () => {
  const { usersList, labsList, departmentsList, addUser } = useLabTrack();

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [filterRole, setFilterRole] = useState('ALL');

  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    universityId: '',
    role: 'assistant',
    departmentId: 'DEPT-EE',
    phone: '',
    assignedLabIds: []
  });

  const handleLabCheckboxChange = (labId) => {
    setNewUserData(prev => {
      const current = prev.assignedLabIds || [];
      const updated = current.includes(labId)
        ? current.filter(id => id !== labId)
        : [...current, labId];
      return { ...prev, assignedLabIds: updated };
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserData.name.trim() || !newUserData.email.trim()) {
      return alert('Please enter name and email');
    }

    const dept = departmentsList.find(d => d.id === newUserData.departmentId);

    await addUser({
      ...newUserData,
      department: dept ? dept.name : 'Engineering Department'
    });

    setShowAddUserModal(false);
    setNewUserData({
      name: '',
      email: '',
      universityId: '',
      role: 'assistant',
      departmentId: 'DEPT-EE',
      phone: '',
      assignedLabIds: []
    });
  };

  let filteredUsers = usersList;
  if (filterRole !== 'ALL') {
    filteredUsers = usersList.filter(u => u.role?.toLowerCase() === filterRole.toLowerCase());
  }

  const columns = [
    {
      header: 'University ID',
      accessor: 'universityId',
      cell: (row) => <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e40af' }}>{row.universityId || row.id}</span>
    },
    {
      header: 'User Profile',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.email}</div>
        </div>
      )
    },
    { header: 'Department', accessor: 'department' },
    {
      header: 'Role & Responsibilities',
      cell: (row) => (
        <div>
          <span className={`badge ${row.role === 'admin' ? 'badge-danger' : row.role === 'assistant' ? 'badge-info' : row.role === 'faculty' ? 'badge-purple' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
            {row.role}
          </span>
          {row.role === 'assistant' && (
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '3px' }}>
              Manages {(row.assignedLabIds || []).length} Lab{(row.assignedLabIds || []).length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Assigned Laboratories',
      cell: (row) => {
        if (row.role !== 'assistant') {
          return <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>N/A (Non-Assistant)</span>;
        }
        const assignedLabs = labsList.filter(l => (row.assignedLabIds || []).includes(l.id));
        if (assignedLabs.length === 0) {
          return <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>No Labs Assigned</span>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {assignedLabs.map(l => (
              <span key={l.id} style={{ fontSize: '0.75rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Building2 size={12} /> {l.name}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div>
      <PageHeader
        title="University User Directory & Role Administration"
        subtitle="Register and manage Lab Assistants, Faculty members, and Student portal accounts"
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
              <UserPlus size={14} /> Register New User
            </button>
            <Link to="/labs" className="btn btn-secondary">
              <Building2 size={14} /> Manage Lab Assignments
            </Link>
          </div>
        }
      />

      {/* Role Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'assistant', 'faculty', 'student', 'admin'].map(role => (
          <button
            key={role}
            onClick={() => setFilterRole(role)}
            className={`btn btn-sm ${filterRole === role ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {role === 'ALL' ? `All Users (${usersList.length})` : `${role}s (${usersList.filter(u => u.role === role).length})`}
          </button>
        ))}
      </div>

      <div className="portal-card">
        <DataTable columns={columns} data={filteredUsers} />
      </div>

      {/* Admin Modal: Register New User */}
      {showAddUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div className="portal-card" style={{ width: '100%', maxWidth: '650px', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="#1e40af" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Register New Campus User / Staff
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddUserModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dr. Alan Turing / John Doe"
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Institutional Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. a.turing@university.edu"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">University ID Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. LAB-2024-089 or FAC-2024-115"
                    value={newUserData.universityId}
                    onChange={(e) => setNewUserData({ ...newUserData, universityId: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  >
                    <option value="assistant">Lab Assistant (Lab Counter & Approvals)</option>
                    <option value="faculty">Faculty Member (30-day Borrowing)</option>
                    <option value="student">Student (14-day Borrowing)</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={newUserData.departmentId}
                    onChange={(e) => setNewUserData({ ...newUserData, departmentId: e.target.value })}
                  >
                    {departmentsList.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+1 (555) 010-0000"
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* If Assistant is chosen: allow selecting multiple assigned laboratories */}
              {newUserData.role === 'assistant' && (
                <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={16} /> Assign Managed Laboratories (Multi-Lab Selection)
                  </label>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.75rem' }}>
                    Select the laboratories this Lab Assistant will be responsible for overseeing and approving requests for:
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {labsList.map(lab => {
                      const isChecked = (newUserData.assignedLabIds || []).includes(lab.id);
                      return (
                        <label
                          key={lab.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8rem',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                            border: `1px solid ${isChecked ? '#bfdbfe' : '#e2e8f0'}`,
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleLabCheckboxChange(lab.id)}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{lab.name}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{lab.id}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <UserPlus size={16} /> Create User Account
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
