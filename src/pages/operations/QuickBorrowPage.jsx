import { formatDate } from '../../utils/dateFormat';
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Zap, QrCode, UserCheck, ArrowLeftRight, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import apiClient from '../../api/client';

export const QuickBorrowPage = () => {
  const [studentId, setStudentId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [step, setStep] = useState(1); // 1 = scan student, 2 = scan equipment
  const [message, setMessage] = useState(null);
  const [activeItems, setActiveItems] = useState([]);
  const [stats, setStats] = useState({ currentlyOut: 0, returnedToday: 0, overdue: 0 });
  const [mode, setMode] = useState('borrow'); // 'borrow' or 'return'

  const fetchActiveItems = async () => {
    try {
      const res = await apiClient.get('/borrowing/transactions');
      const active = res.data.filter(t => t.status === 'ACTIVE' && t.is_quick_borrow);
      setActiveItems(active);
    } catch (e) {
      console.error('Error fetching active items', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/borrowing/quick-borrow/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Error fetching quick-borrow stats', e);
    }
  };

  useEffect(() => {
    fetchActiveItems();
    fetchStats();
    const interval = setInterval(() => {
      fetchActiveItems();
      fetchStats();
    }, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleBorrow = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      const lookup = await apiClient.get('/auth/users/lookup', { params: { q: studentId.trim() } });
      if (lookup.data.length !== 1 || lookup.data[0].role !== 'FACULTY') {
        throw new Error('Enter an exact registered faculty ID or email address.');
      }
      await apiClient.post('/borrowing/quick-borrow', {
        asset_id: assetId.trim(),
        borrower_id: lookup.data[0].id
      });
      setMessage({ type: 'success', text: `✅ Item ${assetId} issued to faculty #${studentId}` });
      setStudentId('');
      setAssetId('');
      setStep(1);
      fetchActiveItems();
      fetchStats();
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.response?.data?.detail || err.message || 'Quick-borrow failed'}` });
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await apiClient.post(`/borrowing/quick-return?asset_id=${assetId.trim()}`);
      setMessage({ type: 'success', text: `✅ Item ${assetId} returned successfully` });
      setAssetId('');
      fetchActiveItems();
      fetchStats();
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.response?.data?.detail || 'Quick-return failed'}` });
    }
  };

  return (
    <div>
      <PageHeader
        title="Quick-Borrow Counter"
        subtitle="Fast issue & return for daily-use lab equipment (multimeters, breadboards, cables)"
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="portal-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <Zap size={24} color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{stats.currentlyOut}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Currently Out</div>
        </div>
        <div className="portal-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <CheckCircle size={24} color="#15803d" style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d' }}>{stats.returnedToday}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Returned Today</div>
        </div>
        <div className="portal-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <AlertTriangle size={24} color="#dc2626" style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626' }}>{stats.overdue}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Overdue</div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          className={`btn ${mode === 'borrow' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setMode('borrow'); setStep(1); setMessage(null); }}
        >
          <Zap size={14} /> Quick Issue
        </button>
        <button
          className={`btn ${mode === 'return' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setMode('return'); setMessage(null); }}
        >
          <ArrowLeftRight size={14} /> Quick Return
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div style={{
          backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#991b1b',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          {message.text}
        </div>
      )}

      {/* Borrow Flow */}
      {mode === 'borrow' && (
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">
              <Zap size={18} /> Quick Issue — {step === 1 ? 'Step 1: Scan Faculty ID' : 'Step 2: Scan Equipment QR'}
            </div>
          </div>
          <form onSubmit={handleBorrow}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">
                  <UserCheck size={14} /> Faculty ID
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter or scan Faculty ID number"
                  value={studentId}
                  onChange={(e) => { setStudentId(e.target.value); if (e.target.value) setStep(2); }}
                  autoFocus
                  style={{ fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 700 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  <QrCode size={14} /> Equipment Asset ID (QR)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Scan equipment QR code"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  disabled={step < 2}
                  style={{ fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 700 }}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!studentId || !assetId}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            >
              <Zap size={16} /> Issue Item Instantly
            </button>
          </form>
        </div>
      )}

      {/* Return Flow */}
      {mode === 'return' && (
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">
              <ArrowLeftRight size={18} /> Quick Return — Scan Equipment QR
            </div>
          </div>
          <form onSubmit={handleReturn}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">
                <QrCode size={14} /> Equipment Asset ID (QR)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Scan equipment QR code to return"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                autoFocus
                style={{ fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 700 }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!assetId}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            >
              <ArrowLeftRight size={16} /> Return Item
            </button>
          </form>
        </div>
      )}

      {/* Currently Out Table */}
      <div className="portal-card" style={{ marginTop: '1.25rem' }}>
        <div className="portal-header">
          <div className="portal-title">
            <Clock size={18} /> Items Currently Out ({activeItems.length})
          </div>
        </div>
        {activeItems.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem', padding: '1rem 0' }}>No quick-borrow items currently out.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Borrower ID</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map(item => {
                  const isOverdue = new Date(item.due_date) < new Date();
                  return (
                    <tr key={item.id} style={{ backgroundColor: isOverdue ? '#fef2f2' : 'transparent' }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e40af' }}>{item.unit_asset_id}</td>
                      <td>{item.borrower_id}</td>
                      <td>{formatDate(item.issue_date)}</td>
                      <td>{formatDate(item.due_date)}</td>
                      <td>
                        <span className={`badge ${isOverdue ? 'badge-danger' : 'badge-warning'}`}>
                          {isOverdue ? '⚠️ Overdue' : 'Out'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
