import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Package, CheckCircle2, QrCode, AlertCircle, ArrowRight, Clock, ShieldCheck } from 'lucide-react';

export const IssueEquipmentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { equipmentList, requestsList, issueEquipmentAction, labsList } = useLabTrack();

  const [step, setStep] = useState(1);
  const [borrowerId, setBorrowerId] = useState('');
  const [borrowerApprovedRequests, setBorrowerApprovedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [scannedUnit, setScannedUnit] = useState(null);
  const [scanError, setScanError] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Assistant's assigned labs
  const assignedLabIds = user?.assignedLabIds || [];
  const isAllLabs = user?.role === 'admin' || assignedLabIds.length === 0;

  // Step 1: Handle scanning borrower's university ID card
  const handleScanBorrower = (code) => {
    const cleanId = (code || '').trim();
    setBorrowerId(cleanId);
    setScanError('');

    // Find APPROVED requests for this borrower in assistant's assigned labs
    const approved = requestsList.filter(req => {
      const matchBorrower = req.requesterId?.toLowerCase() === cleanId.toLowerCase() ||
                            req.requesterName?.toLowerCase().includes(cleanId.toLowerCase());
      const matchStatus = req.status === 'Approved';
      const matchLab = isAllLabs || assignedLabIds.includes(req.labId);
      return matchBorrower && matchStatus && matchLab;
    });

    setBorrowerApprovedRequests(approved);
    setStep(2);
  };

  // Step 2: Select the approved request to fulfill
  const handleSelectRequest = (req) => {
    setSelectedRequest(req);
    setDueDate(req.requiredUntil || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    setScanError('');
  };

  // Step 3: Handle scanning the physical equipment QR code on the item
  const handleScanEquipmentQR = (qrCodeScanned) => {
    setScanError('');
    const cleanQR = (qrCodeScanned || '').trim();

    if (!selectedRequest) {
      setScanError('Please select an approved request first');
      return;
    }

    // Find the equipment model requested
    const targetEq = equipmentList.find(e => e.id === selectedRequest.equipmentId);
    if (!targetEq) {
      setScanError('Requested equipment model not found in inventory');
      return;
    }

    // Look for matching physical unit by assetId
    let matchedUnit = null;
    let parentEquipment = null;

    for (const eq of equipmentList) {
      if (eq.units) {
        const u = eq.units.find(unit => unit.assetId.toLowerCase() === cleanQR.toLowerCase());
        if (u) {
          matchedUnit = u;
          parentEquipment = eq;
          break;
        }
      }
    }

    // Fallback if scanned QR is the equipment ID or generic code
    if (!matchedUnit && targetEq.units && targetEq.units.length > 0) {
      const availableUnit = targetEq.units.find(u => u.status === 'Available');
      if (availableUnit && (targetEq.id.toLowerCase() === cleanQR.toLowerCase() || cleanQR.startsWith('LT-'))) {
        matchedUnit = availableUnit;
        parentEquipment = targetEq;
      }
    }

    if (!matchedUnit) {
      setScanError(`Asset tag "${cleanQR}" does not match any registered unit.`);
      return;
    }

    if (parentEquipment.id !== targetEq.id) {
      setScanError(`Scanned unit (${matchedUnit.assetId}) is a "${parentEquipment.name}", but the approved request is for "${targetEq.name}". Please scan the correct equipment.`);
      return;
    }

    if (matchedUnit.status !== 'Available') {
      setScanError(`Unit ${matchedUnit.assetId} is currently marked as "${matchedUnit.status}". Please choose an available unit.`);
      return;
    }

    // Unit is valid and available!
    setScannedUnit(matchedUnit);
    setStep(3);
  };

  // Confirm Handover
  const handleConfirmIssue = async () => {
    if (!selectedRequest || !scannedUnit) return;

    await issueEquipmentAction({
      requestId: selectedRequest.id,
      equipmentId: selectedRequest.equipmentId,
      equipmentName: selectedRequest.equipmentName,
      unitAssetId: scannedUnit.assetId,
      borrowerName: selectedRequest.requesterName,
      borrowerId: selectedRequest.requesterId,
      borrowerRole: selectedRequest.requesterRole || 'student',
      labId: selectedRequest.labId,
      labName: selectedRequest.labName,
      dueDate: dueDate || selectedRequest.requiredUntil
    });

    navigate('/transactions');
  };

  const resetFlow = () => {
    setStep(1);
    setBorrowerId('');
    setBorrowerApprovedRequests([]);
    setSelectedRequest(null);
    setScannedUnit(null);
    setScanError('');
  };

  return (
    <div>
      <PageHeader
        title="Physical Equipment Issue & Checkout Counter"
        subtitle="Verify approved student/faculty requests and scan asset QR tags during physical handover"
      />

      {/* Step Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          className="portal-card"
          style={{
            backgroundColor: step === 1 ? '#eff6ff' : '#ffffff',
            borderColor: step === 1 ? '#3b82f6' : '#e2e8f0',
            marginBottom: 0,
            padding: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: step >= 1 ? '#1e40af' : '#94a3b8', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</span>
            <strong>1. Scan Borrower ID</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0' }}>Verify requester identity & approved requests</p>
        </div>

        <div
          className="portal-card"
          style={{
            backgroundColor: step === 2 ? '#eff6ff' : '#ffffff',
            borderColor: step === 2 ? '#3b82f6' : '#e2e8f0',
            marginBottom: 0,
            padding: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: step >= 2 ? '#1e40af' : '#94a3b8', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>2</span>
            <strong>2. Scan Equipment QR</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0' }}>Scan the unique physical asset label</p>
        </div>

        <div
          className="portal-card"
          style={{
            backgroundColor: step === 3 ? '#eff6ff' : '#ffffff',
            borderColor: step === 3 ? '#3b82f6' : '#e2e8f0',
            marginBottom: 0,
            padding: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: step >= 3 ? '#1e40af' : '#94a3b8', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>3</span>
            <strong>3. Confirm Handover</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0' }}>Confirm dates & complete issue record</p>
        </div>
      </div>

      {/* STEP 1: Scan Borrower ID */}
      {step === 1 && (
        <div>
          <div className="portal-card" style={{ marginBottom: '1.25rem', backgroundColor: '#f8fafc' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              Workflow Rule: Assistant-Approved Handover
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0 }}>
              Students and faculty must submit an online request and receive <strong>Lab Assistant approval</strong> prior to visiting the lab counter. Scan their University ID card or enter their Student ID below to find approved requests.
            </p>
          </div>

          <BarcodeScanner
            onScan={handleScanBorrower}
            title="Scan Borrower University ID Card"
            placeholder="e.g. STU-2024-884 or Alex Johnson"
            mockDataToReturn="STU-2024-884"
          />
        </div>
      )}

      {/* STEP 2: Select Request & Scan Equipment QR */}
      {step === 2 && (
        <div>
          {/* Borrower summary strip */}
          <div className="portal-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: '#22c55e', color: '#fff', borderRadius: '50%', padding: '6px', display: 'flex' }}>
                <UserCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#15803d' }}>
                  Borrower Identity: {borrowerId}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#166534' }}>
                  {borrowerApprovedRequests.length} Approved Request{borrowerApprovedRequests.length === 1 ? '' : 's'} Ready for Handover
                </div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={resetFlow}>
              Scan Different User
            </button>
          </div>

          {borrowerApprovedRequests.length === 0 ? (
            <div className="portal-card" style={{ backgroundColor: '#fffbeb', borderColor: '#fef08a', textAlign: 'center', padding: '2rem' }}>
              <AlertCircle size={36} color="#d97706" style={{ margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>
                No Approved Requests Found
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#78350f', maxWidth: '500px', margin: '0 auto 1rem' }}>
                Borrower <strong>{borrowerId}</strong> does not have any pending approved requests for your managed laboratories. All borrowing must be requested and approved on the portal first.
              </p>
              <button className="btn btn-secondary" onClick={resetFlow}>
                Back to Counter Scanner
              </button>
            </div>
          ) : (
            <div>
              {/* Request selection */}
              <div className="portal-card" style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
                  1. Select Approved Request to Issue:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {borrowerApprovedRequests.map(req => {
                    const isSelected = selectedRequest?.id === req.id;
                    return (
                      <div
                        key={req.id}
                        onClick={() => handleSelectRequest(req)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          borderRadius: '8px',
                          padding: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>{req.id}</span>
                            <span className="badge badge-success">Approved</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.labName}</span>
                          </div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                            {req.equipmentName} (Qty: {req.quantity || 1})
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                            <strong>Purpose:</strong> {req.purpose} | <strong>Due Date:</strong> {req.requiredUntil}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}>
                            {isSelected ? 'Selected' : 'Select Request'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR Code Scanner for the Equipment Unit */}
              {selectedRequest && (
                <div>
                  {scanError && (
                    <div className="portal-card" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{scanError}</span>
                    </div>
                  )}

                  <BarcodeScanner
                    onScan={handleScanEquipmentQR}
                    title={`Scan Physical Asset QR on "${selectedRequest.equipmentName}"`}
                    placeholder="e.g. LT-IOT-MC-00001 or LT-CS-VR-00001"
                    mockDataToReturn="LT-CS-VR-00001"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Confirm Issue Handover */}
      {step === 3 && selectedRequest && scannedUnit && (
        <div className="portal-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ backgroundColor: '#1e40af', color: '#fff', borderRadius: '50%', padding: '8px', display: 'flex' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Confirm Physical Equipment Handover
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                All validation checks passed. Review details before recording checkout.
              </p>
            </div>
          </div>

          {/* Handover Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>BORROWER</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedRequest.requesterName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>{selectedRequest.requesterId} ({selectedRequest.requesterRole})</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>LABORATORY</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedRequest.labName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>Assistant In-Charge: {user?.name}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>EQUIPMENT MODEL</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedRequest.equipmentName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>Model ID: {selectedRequest.equipmentId}</div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>SCANNED ASSET QR TAG</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace' }}>{scannedUnit.assetId}</div>
              <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Condition: {scannedUnit.condition}</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Approved Return Due Date</label>
            <input
              type="date"
              className="form-control"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <small style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Students: Max 14 days | Faculty: Max 30 days. Extensions can be requested online later without re-scanning.
            </small>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleConfirmIssue} style={{ flex: 1 }}>
              <CheckCircle2 size={16} /> Complete Physical Handover & Issue
            </button>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
