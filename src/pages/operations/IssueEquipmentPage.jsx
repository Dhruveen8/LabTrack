import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';
import { useLabTrack } from '../../context/LabTrackContext';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Package, CheckCircle2, ArrowRight } from 'lucide-react';

export const IssueEquipmentPage = () => {
  const navigate = useNavigate();
  const { equipmentList, issueEquipmentAction } = useLabTrack();

  const [step, setStep] = useState(1);
  const [borrower, setBorrower] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [dueDate, setDueDate] = useState('2026-08-25');
  const [purpose, setPurpose] = useState('Academic Lab Session');

  const handleScanUser = (code) => {
    setBorrower({
      name: 'Alex Johnson',
      universityId: code || 'STU-2024-884',
      department: 'Computer Science B.Tech',
      role: 'Student'
    });
    setStep(2);
  };

  const handleScanEquipment = (code) => {
    const eq = equipmentList.find(e => e.id === code || e.qrCode === code) || equipmentList[0];
    setSelectedEquipment(eq);
    setStep(3);
  };

  const handleConfirmIssue = async () => {
    if (!borrower || !selectedEquipment) return;
    await issueEquipmentAction({
      equipmentId: selectedEquipment.id,
      equipmentName: selectedEquipment.name,
      borrowerName: borrower.name,
      borrowerId: borrower.universityId,
      borrowerRole: borrower.role,
      labName: selectedEquipment.labName,
      dueDate
    });
    navigate('/transactions');
  };

  return (
    <div>
      <PageHeader title="Issue Equipment Counter Desk" subtitle="Scan Borrower University ID & Equipment Asset QR to process borrowing" />

      {/* Step Indicator */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="portal-card" style={{ flex: 1, backgroundColor: step >= 1 ? '#eff6ff' : '#fff', borderColor: step >= 1 ? '#bfdbfe' : '#e2e8f0', marginBottom: 0 }}>
          <strong>1. Scan Borrower ID</strong>
        </div>
        <div className="portal-card" style={{ flex: 1, backgroundColor: step >= 2 ? '#eff6ff' : '#fff', borderColor: step >= 2 ? '#bfdbfe' : '#e2e8f0', marginBottom: 0 }}>
          <strong>2. Scan Equipment QR</strong>
        </div>
        <div className="portal-card" style={{ flex: 1, backgroundColor: step >= 3 ? '#eff6ff' : '#fff', borderColor: step >= 3 ? '#bfdbfe' : '#e2e8f0', marginBottom: 0 }}>
          <strong>3. Confirm & Due Date</strong>
        </div>
      </div>

      {step === 1 && (
        <BarcodeScanner onScan={handleScanUser} title="Scan Borrower University ID Card" mockDataToReturn="STU-2024-884" />
      )}

      {step === 2 && (
        <div>
          <div className="portal-card" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <h4 style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}><UserCheck size={18} /> Borrower Verified</h4>
            <p style={{ margin: '4px 0 0' }}><strong>{borrower.name}</strong> ({borrower.universityId}) - {borrower.department}</p>
          </div>
          <BarcodeScanner onScan={handleScanEquipment} title="Scan Equipment Asset QR Code" mockDataToReturn="EQ-1001" />
        </div>
      )}

      {step === 3 && selectedEquipment && (
        <div className="portal-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Confirm Equipment Issue</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <strong>Borrower:</strong> {borrower.name} ({borrower.universityId})
            </div>
            <div>
              <strong>Equipment:</strong> {selectedEquipment.name} ({selectedEquipment.id})
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Return Due Date</label>
            <input type="date" className="form-control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Borrowing Purpose</label>
            <input type="text" className="form-control" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleConfirmIssue}>
            <CheckCircle2 size={16} /> Confirm Equipment Issue
          </button>
        </div>
      )}
    </div>
  );
};
