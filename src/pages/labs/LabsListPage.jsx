import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Building2, Package, CheckCircle, Clock, Wrench, UserCheck, Plus, UserPlus, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LabsListPage = () => {
  const { user } = useAuth();
  const { labsList, departmentsList, usersList, addLab, assignAssistantToLab } = useLabTrack();

  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetLab, setTargetLab] = useState(null);

  const [newLabData, setNewLabData] = useState({
    name: '',
    departmentId: 'DEPT-EE',
    location: '',
    description: '',
    inchargeUserId: 'USR-1002'
  });

  const [selectedAssistantId, setSelectedAssistantId] = useState('USR-1002');

  const isAdmin = user?.role === 'admin';
  const assistants = usersList.filter(u => u.role === 'assistant');

  // Filter labs
  let filteredLabs = labsList;
  if (selectedDeptId !== 'ALL') {
    filteredLabs = labsList.filter(l => l.departmentId === selectedDeptId);
  }

  const handleCreateLab = async (e) => {
    e.preventDefault();
    if (!newLabData.name.trim()) return alert('Please enter laboratory name');

    const selectedDept = departmentsList.find(d => d.id === newLabData.departmentId);
    const selectedAss = usersList.find(u => u.id === newLabData.inchargeUserId);

    await addLab({
      ...newLabData,
      departmentName: selectedDept ? selectedDept.name : '',
      incharge: selectedAss ? selectedAss.name : 'Unassigned'
    });

    setShowAddLabModal(false);
    setNewLabData({
      name: '',
      departmentId: 'DEPT-EE',
      location: '',
      description: '',
      inchargeUserId: 'USR-1002'
    });
  };

  const handleAssignAssistant = async (e) => {
    e.preventDefault();
    if (!targetLab || !selectedAssistantId) return;

    const ass = usersList.find(u => u.id === selectedAssistantId);
    if (!ass) return;

    await assignAssistantToLab(targetLab.id, ass.id, ass.name);
    setShowAssignModal(false);
    setTargetLab(null);
  };

  const openAssignModal = (lab) => {
    setTargetLab(lab);
    setSelectedAssistantId(lab.inchargeUserId || (assistants[0]?.id || 'USR-1002'));
    setShowAssignModal(true);
  };

  return (
    <div>
      <PageHeader
        title="University Department Laboratories"
        subtitle="Multi-lab departmental facilities and assigned Lab Assistant oversight"
        actions={
          isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowAddLabModal(true)}>
              <Plus size={14} /> Register New Laboratory
            </button>
          )
        }
      />

      {/* Department Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginRight: '0.25rem' }}>
          Filter Department:
        </span>
        <button
          onClick={() => setSelectedDeptId('ALL')}
          className={`btn btn-sm ${selectedDeptId === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Departments ({labsList.length} Labs)
        </button>
        {departmentsList.map(dept => {
          const count = labsList.filter(l => l.departmentId === dept.id).length;
          return (
            <button
              key={dept.id}
              onClick={() => setSelectedDeptId(dept.id)}
              className={`btn btn-sm ${selectedDeptId === dept.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {dept.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Labs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {filteredLabs.map(lab => {
          const isUserAssigned = user?.assignedLabIds?.includes(lab.id);
          const dept = departmentsList.find(d => d.id === lab.departmentId);

          return (
            <div
              key={lab.id}
              className="portal-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: isUserAssigned ? '2px solid #3b82f6' : '1px solid var(--color-border)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af' }}>
                    <Building2 size={20} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, fontFamily: 'monospace' }}>{lab.id}</span>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                    {dept?.name || lab.departmentName || lab.departmentId}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                  {lab.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  📍 {lab.location}
                </p>

                {/* Assistant in charge strip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#334155' }}>
                    <UserCheck size={16} color="#1e40af" />
                    <span>In-Charge: <strong>{lab.incharge || 'Unassigned'}</strong></span>
                  </div>
                  {isAdmin && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => openAssignModal(lab)}
                    >
                      <UserPlus size={12} /> Assign
                    </button>
                  )}
                </div>

                <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '1rem', minHeight: '40px' }}>
                  {lab.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <div>Total Equipment: <strong>{lab.totalEquipment}</strong></div>
                  <div>Available: <strong style={{ color: '#15803d' }}>{lab.available}</strong></div>
                  <div>Borrowed: <strong style={{ color: '#1e40af' }}>{lab.borrowed}</strong></div>
                  <div>Pending Transfers: <strong style={{ color: '#b45309' }}>{lab.pendingTransfers || 0}</strong></div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <Link to={`/equipment?lab=${lab.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <Package size={13} /> View Inventory ({lab.totalEquipment})
                </Link>
                {(user?.role === 'student' || user?.role === 'faculty') && (
                  <Link to="/request-equipment" className="btn btn-primary btn-sm">
                    Request
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin Modal: Create Laboratory */}
      {showAddLabModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="portal-card" style={{ width: '100%', maxWidth: '600px', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Register New Department Laboratory</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddLabModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateLab}>
              <div className="form-group">
                <label className="form-label">Laboratory Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={newLabData.name}
                  onChange={(e) => setNewLabData({ ...newLabData, name: e.target.value })}
                  placeholder="e.g. Wireless & RF Communication Lab"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Parent Department</label>
                  <select
                    className="form-select"
                    value={newLabData.departmentId}
                    onChange={(e) => setNewLabData({ ...newLabData, departmentId: e.target.value })}
                  >
                    {departmentsList.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Lab Assistant</label>
                  <select
                    className="form-select"
                    value={newLabData.inchargeUserId}
                    onChange={(e) => setNewLabData({ ...newLabData, inchargeUserId: e.target.value })}
                  >
                    {assistants.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.universityId})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Room / Building Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={newLabData.location}
                  onChange={(e) => setNewLabData({ ...newLabData, location: e.target.value })}
                  placeholder="e.g. Science Block 3, Room 408"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Purpose</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={newLabData.description}
                  onChange={(e) => setNewLabData({ ...newLabData, description: e.target.value })}
                  placeholder="Focus areas, specialized test benches..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Laboratory
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddLabModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Modal: Assign Assistant */}
      {showAssignModal && targetLab && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="portal-card" style={{ width: '100%', maxWidth: '500px', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Assign Lab Assistant</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAssignModal(false)}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: '1rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Target Laboratory:</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{targetLab.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>{targetLab.departmentName || targetLab.departmentId}</div>
            </div>

            <form onSubmit={handleAssignAssistant}>
              <div className="form-group">
                <label className="form-label">Select Lab Assistant to Assign</label>
                <select
                  className="form-select"
                  value={selectedAssistantId}
                  onChange={(e) => setSelectedAssistantId(e.target.value)}
                >
                  {assistants.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.department || 'Department'}) — Currently manages {(a.assignedLabIds || []).length} labs
                    </option>
                  ))}
                </select>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  A single lab assistant can manage multiple laboratories within the department.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Assignment
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
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
