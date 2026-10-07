import { formatDate } from '../../utils/dateFormat';
import apiClient from '../../api/client';
import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';
import { useLabTrack } from '../../context/hooks';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, PackageCheck } from 'lucide-react';

export const ReturnEquipmentPage = () => {
  const navigate = useNavigate();
  const { transactionsList, returnEquipmentAction } = useLabTrack();

  const [selectedTxn, setSelectedTxn] = useState(null);
  const [condition, setCondition] = useState('Excellent');
  const [remarks, setRemarks] = useState('Returned in verified condition');
  const [scanError, setScanError] = useState('');

  const handleScan = async (code) => {
    setScanError('');
    // FIX: Strip URL prefix from scanned QR codes — old labels encoded full URLs
    let cleanCode = (code || '').trim();
    if (cleanCode.startsWith('http')) {
      try {
        const url = new URL(cleanCode);
        const pathParts = url.pathname.split('/').filter(Boolean);
        cleanCode = pathParts[pathParts.length - 1] || cleanCode;
      } catch {
        // Not a valid URL, use as-is
      }
    }

    try {
      // Validate unit exists in backend
      const unitRes = await apiClient.get(`/inventory/units/${cleanCode}`);
      const apiUnit = unitRes.data;

      // Ensure unit is actually ISSUED
      if (apiUnit.status !== 'ISSUED') {
         setScanError(`Unit ${cleanCode} is not currently checked out (Status: ${apiUnit.status}).`);
         return;
      }

      // Find the EXACT matching active transaction
      const txn = transactionsList.find(
        t => t.unitAssetId === apiUnit.asset_id && (t.status === 'Issued' || t.status === 'Overdue')
      );

      if (!txn) {
        setScanError(`No active transaction found for unit "${cleanCode}" in current session data. Try refreshing the page.`);
        return;
      }

      setSelectedTxn(txn);

    } catch (error) {
      if (error.response?.status === 404) {
        setScanError(`Asset tag "${cleanCode}" not found in inventory.`);
      } else {
        setScanError(`Error verifying unit: ${error.message}`);
      }
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedTxn) return;
    await returnEquipmentAction(selectedTxn.id, selectedTxn.unitAssetId, condition, remarks);
    navigate('/transactions');
  };

  return (
    <div>
      <PageHeader
        title="Physical Equipment Return & Restocking Counter"
        subtitle="Scan returned equipment asset QR code to verify condition & restore unit to laboratory inventory"
      />

      {!selectedTxn ? (
        <div>
          {scanError && (
            <div className="portal-card" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{scanError}</span>
            </div>
          )}

          <BarcodeScanner
            onScan={handleScan}
            title="Scan Returned Equipment Asset QR Tag"
            placeholder="e.g. LT-IOT-SBC-00001 or EQ-1002"
            mockDataToReturn="LT-IOT-SBC-00001"
          />
        </div>
      ) : (
        <div className="portal-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ backgroundColor: '#15803d', color: '#fff', borderRadius: '50%', padding: '8px', display: 'flex' }}>
              <PackageCheck size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Verify Return & Inspect Condition
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                Asset tag recognized. Review checkout record and record return condition.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>EQUIPMENT MODEL</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedTxn.equipmentName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>Origin: {selectedTxn.originLab}</div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>ASSET QR TAG ID</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace' }}>
                {selectedTxn.unitAssetId || selectedTxn.equipmentId}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Txn Ref: {selectedTxn.id}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>BORROWER</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedTxn.borrowerName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>{selectedTxn.borrowerId} ({selectedTxn.borrowerType})</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>DATES</div>
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>Issued: <strong>{formatDate(selectedTxn.issueDate)}</strong></div>
              <div style={{ fontSize: '0.85rem', color: selectedTxn.status === 'Overdue' ? '#dc2626' : '#334155' }}>
                Due: <strong>{formatDate(selectedTxn.dueDate)}</strong> {selectedTxn.status === 'Overdue' ? '(Overdue)' : ''}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Return Physical Condition</label>
            <select className="form-select" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="Excellent">Excellent - Clean & Full Working Condition</option>
              <option value="Good">Good - Normal Academic Wear & Tear</option>
              <option value="Calibration Required">Calibration / Maintenance Required</option>
              <option value="Damaged">Damaged / Missing Accessories</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Assistant Remarks / Inspection Notes</label>
            <input
              type="text"
              className="form-control"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Cables and power supply verified intact"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleConfirmReturn} style={{ flex: 1 }}>
              <CheckCircle2 size={16} /> Confirm Return & Restore Unit to Stock
            </button>
            <button className="btn btn-secondary" onClick={() => setSelectedTxn(null)}>
              Cancel / Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
