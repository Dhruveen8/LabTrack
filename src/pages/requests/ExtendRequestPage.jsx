import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, ArrowLeft, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ExtendRequestPage = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { transactionsList, requestsList, requestExtensionAction, systemSettings } = useLabTrack();

  // Find transaction
  const txn = transactionsList.find(t => t.id === transactionId || t.unitAssetId === transactionId) || transactionsList[0];
  const linkedReq = requestsList.find(r => r.id === txn?.requestId || (r.equipmentId === txn?.equipmentId && r.requesterId === txn?.borrowerId));

  const userRole = user?.role || txn?.borrowerType || 'student';
  const isFaculty = userRole === 'faculty';

  // Consume dynamic borrowing limits set by Admin
  const maxDaysTotal = isFaculty
    ? (systemSettings?.facultyBorrowLimitDays || 30)
    : (systemSettings?.studentBorrowLimitDays || 14);

  const issueDateObj = new Date(txn?.issueDate || Date.now());
  const maxAllowedEndDate = new Date(issueDateObj.getTime() + maxDaysTotal * 86400000).toISOString().split('T')[0];

  const currentDueStr = txn?.dueDate || new Date().toISOString().split('T')[0];
  const [newDueDate, setNewDueDate] = useState(maxAllowedEndDate);
  const [reason, setReason] = useState('Requires additional experimentation time for project milestones');
  const [errorMsg, setErrorMsg] = useState('');

  if (!txn) {
    return (
      <div className="portal-card">
        <p>Transaction not found.</p>
        <Link to="/transactions" className="btn btn-secondary">Back to Transactions</Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const newDueObj = new Date(newDueDate);
    const currDueObj = new Date(currentDueStr);

    if (newDueObj <= currDueObj) {
      setErrorMsg('New due date must be after the current return due date.');
      return;
    }

    if (newDueObj > new Date(maxAllowedEndDate)) {
      setErrorMsg(`Cannot extend beyond configured max period of ${maxDaysTotal} days (${maxAllowedEndDate}).`);
      return;
    }

    const reqId = linkedReq?.id || txn.requestId || `REQ-${txn.id}`;
    await requestExtensionAction(reqId, txn.id, newDueDate, reason);
    navigate('/requests');
  };

  return (
    <div>
      <PageHeader
        title="Request Equipment Borrowing Extension / Re-Issue"
        subtitle="Apply for an online extension. No physical QR scanning is needed — the Lab Assistant can approve digitally."
        actions={
          <Link to="/transactions" className="btn btn-secondary">
            <ArrowLeft size={14} /> Back to My Borrowings
          </Link>
        }
      />

      <div className="portal-card" style={{ maxWidth: '750px', margin: '0 auto' }}>
        {/* Policy notice */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.85rem 1rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
          <RefreshCw size={20} color="#15803d" />
          <div style={{ fontSize: '0.85rem', color: '#14532d' }}>
            <strong>Digital Re-Issue Protocol:</strong> You do not need to bring the equipment back to the lab for scanning. Maximum allowed total period is <strong>{maxDaysTotal} days</strong>.
          </div>
        </div>

        {errorMsg && (
          <div className="portal-card" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{errorMsg}</span>
          </div>
        )}

        {/* Current Transaction Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>EQUIPMENT NAME</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{txn.equipmentName}</div>
            <div style={{ fontSize: '0.8rem', color: '#1e40af', fontFamily: 'monospace' }}>Asset Tag: {txn.unitAssetId || txn.equipmentId}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ORIGIN LAB</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{txn.originLab}</div>
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>Transaction Ref: {txn.id}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ORIGINAL ISSUE DATE</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{txn.issueDate}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CURRENT DUE DATE</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#dc2626' }}>{txn.dueDate}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Requested Extended Due Date (Configured Max: {maxAllowedEndDate})
            </label>
            <input
              type="date"
              className="form-control"
              value={newDueDate}
              min={currentDueStr}
              max={maxAllowedEndDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              required
            />
            <small style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {isFaculty ? 'Faculty' : 'Students'} are configured for a total period of up to {maxDaysTotal} days from original issue date.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Extension / Re-Issue</label>
            <textarea
              className="form-control"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why extra time is needed for course deliverables or testing"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <RefreshCw size={16} /> Submit Extension Request to Lab Assistant
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/transactions')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
