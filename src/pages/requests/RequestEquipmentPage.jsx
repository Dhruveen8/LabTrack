import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Send, Clock } from 'lucide-react';

export const RequestEquipmentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { equipmentList, createRequestAction } = useLabTrack();

  const [selectedEqId, setSelectedEqId] = useState(equipmentList[0]?.id || 'EQ-1001');
  const [qty, setQty] = useState(1);
  const [fromDate, setFromDate] = useState('2026-08-12');
  const [untilDate, setUntilDate] = useState('2026-08-20');
  const [purpose, setPurpose] = useState('Coursework Capstone Project Simulation');

  const selectedEq = equipmentList.find(e => e.id === selectedEqId) || equipmentList[0];
  const isUnavailable = selectedEq && selectedEq.availableQuantity === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createRequestAction({
      requesterName: user?.name || 'Portal User',
      requesterId: user?.universityId || 'STU-2024-884',
      requesterRole: user?.role || 'Student',
      equipmentId: selectedEq.id,
      equipmentName: selectedEq.name,
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
      <PageHeader title="Submit Equipment Reservation Request" subtitle="Apply for laboratory equipment checkout for academic research or course projects" />

      <div className="portal-card" style={{ maxWidth: '700px' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Equipment</label>
            <select className="form-select" value={selectedEqId} onChange={(e) => setSelectedEqId(e.target.value)}>
              {equipmentList.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.id}) - {eq.availableQuantity > 0 ? `${eq.availableQuantity} Available` : 'Currently Unavailable'}
                </option>
              ))}
            </select>
          </div>

          {isUnavailable && (
            <div className="portal-card" style={{ backgroundColor: '#fffbeb', borderColor: '#fef08a', marginBottom: '1rem' }}>
              <div style={{ color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Currently Unavailable
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                Expected Return Date: 15 August | <strong>Waitlist Position #2</strong>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Required From Date</label>
              <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Required Until Date</label>
              <input type="date" className="form-control" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Quantity Required</label>
            <input type="number" className="form-control" value={qty} min="1" onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Purpose / Project Title</label>
            <textarea className="form-control" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary">
            <Send size={16} /> {isUnavailable ? 'Join Waitlist & Submit Request' : 'Submit Reservation Request'}
          </button>
        </form>
      </div>
    </div>
  );
};
