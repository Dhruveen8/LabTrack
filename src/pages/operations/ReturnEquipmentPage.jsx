import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';
import { useLabTrack } from '../../context/LabTrackContext';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, History } from 'lucide-react';

export const ReturnEquipmentPage = () => {
  const navigate = useNavigate();
  const { transactionsList, returnEquipmentAction } = useLabTrack();

  const [selectedTxn, setSelectedTxn] = useState(null);
  const [condition, setCondition] = useState('Excellent');
  const [remarks, setRemarks] = useState('Returned in good order');

  const handleScan = (code) => {
    const txn = transactionsList.find(t => t.equipmentId === code || t.id === code) || transactionsList[0];
    setSelectedTxn(txn);
  };

  const handleConfirmReturn = async () => {
    if (!selectedTxn) return;
    await returnEquipmentAction(selectedTxn.id, condition, remarks);
    navigate('/transactions');
  };

  return (
    <div>
      <PageHeader title="Return Equipment Counter Desk" subtitle="Scan returned item QR code to verify condition & restore to available inventory" />

      {!selectedTxn ? (
        <BarcodeScanner onScan={handleScan} title="Scan Returned Equipment QR Code" mockDataToReturn="EQ-1002" />
      ) : (
        <div className="portal-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Return Item Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div><strong>Equipment Name:</strong> {selectedTxn.equipmentName}</div>
            <div><strong>Asset Tag ID:</strong> {selectedTxn.equipmentId}</div>
            <div><strong>Borrower Name:</strong> {selectedTxn.borrowerName}</div>
            <div><strong>Issue Date:</strong> {selectedTxn.issueDate}</div>
          </div>

          <div className="form-group">
            <label className="form-label">Return Physical Condition</label>
            <select className="form-select" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="Excellent">Excellent - Normal Wear</option>
              <option value="Good">Good - Minor Scratches</option>
              <option value="Calibration Required">Calibration Required</option>
              <option value="Damaged">Damaged - Needs Repair</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Remarks / Inspection Notes</label>
            <input type="text" className="form-control" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleConfirmReturn}>
              <CheckCircle2 size={16} /> Process Return & Update Stock
            </button>
            <button className="btn btn-secondary" onClick={() => setSelectedTxn(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
