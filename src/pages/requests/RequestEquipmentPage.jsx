import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Send, Clock, AlertCircle, Calendar } from 'lucide-react';

export const RequestEquipmentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { equipmentList, createRequestAction, systemSettings } = useLabTrack();

  const userRole = user?.role || 'student';
  const isFaculty = userRole === 'faculty';

  // Consume dynamic borrowing limits set by Admin
  const maxDays = isFaculty
    ? (systemSettings?.facultyBorrowLimitDays || 30)
    : (systemSettings?.studentBorrowLimitDays || 14);

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultEndStr = new Date(Date.now() + Math.min(maxDays, isFaculty ? 14 : 7) * 86400000).toISOString().split('T')[0];

  const [selectedEqId, setSelectedEqId] = useState(equipmentList[0]?.id || 'EQ-1001');
  const [qty, setQty] = useState(1);
  const [fromDate, setFromDate] = useState(todayStr);
  const [untilDate, setUntilDate] = useState(defaultEndStr);
  const [purpose, setPurpose] = useState('Academic Coursework / Capstone Project');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedEq = equipmentList.find(e => e.id === selectedEqId) || equipmentList[0];
  const isUnavailable = selectedEq && selectedEq.availableQuantity === 0;

  // Calculate requested duration in days
  const startD = new Date(fromDate);
  const endD = new Date(untilDate);
  const diffTime = endD.getTime() - startD.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isDurationValid = diffDays >= 1 && diffDays <= maxDays;

  // Max selectable date based on dynamic limit
  const maxAllowedDate = new Date(startD.getTime() + maxDays * 86400000).toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (diffDays < 1) {
      setErrorMsg('Return date must be after the required start date.');
      return;
    }

    if (diffDays > maxDays) {
      setErrorMsg(`Exceeded maximum borrowing limit! ${isFaculty ? 'Faculty' : 'Students'} are currently configured for a maximum of ${maxDays} days per checkout (${diffDays} days selected).`);
      return;
    }

    await createRequestAction({
      requesterName: user?.name || 'Portal User',
      requesterId: user?.universityId || 'STU-2024-884',
      requesterRole: userRole,
      department: user?.department || 'Engineering',
      equipmentId: selectedEq.id,
      equipmentName: selectedEq.name,
      labId: selectedEq.labId,
      labName: selectedEq.labName,
      quantity: qty,
      requiredFrom: fromDate,
      requiredUntil: untilDate,
      purpose
    });

    navigate('/requests');
  };

  return (
    <div>
      <PageHeader
        title="Submit Equipment Reservation Request"
        subtitle={`Apply for lab asset checkout. Institutional limit: ${maxDays} days max for ${isFaculty ? 'faculty' : 'students'}.`}
      />

      <div className="portal-card" style={{ maxWidth: '700px' }}>
        {/* Role limit policy banner */}
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <Calendar size={20} color="#1d4ed8" />
          <div style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>
            <strong>Institutional Checkout Policy: </strong>
            Logged in as <strong>{user?.name}</strong> ({userRole}). Your maximum configured borrowing period is <strong>{maxDays} days</strong>. If you need it longer, you can submit a digital extension from the portal later without re-scanning.
          </div>
        </div>

        {errorMsg && (
          <div className="portal-card" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Equipment</label>
            <select
              className="form-select"
              value={selectedEqId}
              onChange={(e) => setSelectedEqId(e.target.value)}
            >
              {equipmentList.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.id}) — {eq.labName} ({eq.availableQuantity > 0 ? `${eq.availableQuantity} Available` : 'Currently Unavailable'})
                </option>
              ))}
            </select>
          </div>

          {isUnavailable && (
            <div className="portal-card" style={{ backgroundColor: '#fffbeb', borderColor: '#fef08a', marginBottom: '1rem' }}>
              <div style={{ color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Currently All Units In Use
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                You can still submit a request to join the reservation waitlist.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Required From Date</label>
              <input
                type="date"
                className="form-control"
                value={fromDate}
                min={todayStr}
                onChange={(e) => setFromDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Required Until Date (Max: {maxAllowedDate})</label>
              <input
                type="date"
                className="form-control"
                value={untilDate}
                min={fromDate}
                max={maxAllowedDate}
                onChange={(e) => setUntilDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Duration Indicator */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: isDurationValid ? '#f0fdf4' : '#fef2f2', borderRadius: '6px', border: `1px solid ${isDurationValid ? '#bbf7d0' : '#fecaca'}` }}>
            <span style={{ fontSize: '0.8rem', color: isDurationValid ? '#166534' : '#991b1b', fontWeight: 600 }}>
              Requested Duration: <strong>{isNaN(diffDays) ? 0 : diffDays} day{diffDays === 1 ? '' : 's'}</strong> (Configured Max: {maxDays} days)
            </span>
            {!isDurationValid && (
              <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>
                Exceeds Limit!
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Quantity Required</label>
            <input
              type="number"
              className="form-control"
              value={qty}
              min="1"
              max={selectedEq?.availableQuantity || 1}
              onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Purpose / Project Title</label>
            <textarea
              className="form-control"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Provide course code, project objective, or research demonstration details"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isDurationValid}
            style={{ width: '100%' }}
          >
            <Send size={16} /> Submit Equipment Request for Assistant Review
          </button>
        </form>
      </div>
    </div>
  );
};
