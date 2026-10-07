import { useLabTrack, useAuth } from '../../context/hooks';
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';
import apiClient from '../../api/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCheck, CheckCircle2, AlertCircle, ShieldCheck, Zap } from 'lucide-react';

export const IssueEquipmentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { equipmentList, requestsList, issueEquipmentAction, refreshData } = useLabTrack();

  const [step, setStep] = useState(1);

  // Borrower details
  const [borrowerId, setBorrowerId] = useState(''); // Just the string ID for display
  const [borrowerUserId, setBorrowerUserId] = useState(null); // The actual DB integer ID
  const [borrowerApprovedRequests, setBorrowerApprovedRequests] = useState([]);

  // Issue details
  const [selectedRequest, setSelectedRequest] = useState(null); // 'WALKIN' or { request object }
  const [scannedUnit, setScannedUnit] = useState(null);
  const [walkInModel, setWalkInModel] = useState(null); // To store equipment model details for walkin
  const [scanError, setScanError] = useState('');

  // Form fields
  const [dueDate, setDueDate] = useState('');

  // Assistant's assigned labs
  const assignedLabIds = user?.assignedLabIds || [];
  const isAllLabs = user?.role === 'admin' || assignedLabIds.length === 0;

  // Auto-Issue from Manage Requests Page
  useEffect(() => {
    const autoRequestId = searchParams.get('autoRequestId');
    if (autoRequestId && requestsList.length > 0) {
      const req = requestsList.find(r => r.id === parseInt(autoRequestId));
      if (req) {
        setBorrowerId(`User ID: ${req.requesterId}`);
        setBorrowerUserId(req.requesterId);
        setBorrowerApprovedRequests([req]);
        setSelectedRequest(req);
        setDueDate(req.requiredUntil?.slice(0, 10) || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
        setStep(2);
      }
    }
  }, [searchParams, requestsList]);

  // Step 1: Handle scanning borrower's university ID card
  const handleScanBorrower = async (code) => {
    const cleanId = (code || '').trim();
    setBorrowerId(cleanId);
    setScanError('');

    try {
      const userRes = await apiClient.get(`/auth/users/lookup?q=${encodeURIComponent(cleanId)}`);
      const matchedUsers = userRes.data;

      if (!matchedUsers || matchedUsers.length === 0) {
        setScanError(`No user found matching ID: ${cleanId}`);
        return;
      }
      if (matchedUsers.length !== 1) {
        setScanError('This ID matches more than one account. Use the exact registered email address.');
        return;
      }

      const resolvedUserId = matchedUsers[0].id;
      setBorrowerUserId(resolvedUserId);

      // Find APPROVED requests for this borrower in assistant's assigned labs
      const approved = requestsList.filter(req => {
        const matchBorrower = req.requesterId === resolvedUserId;
        const matchStatus = req.status === 'Approved';
        const matchLab = isAllLabs || assignedLabIds.includes(req.labId);
        return matchBorrower && matchStatus && matchLab;
      });

      setBorrowerApprovedRequests(approved);

      // Even if 0, we go to step 2 to allow walk-in
      setStep(2);
    } catch (error) {
      setScanError(`Error looking up user: ${error.message}`);
    }
  };

  // Step 2: Select the approved request to fulfill
  const handleSelectRequest = (req) => {
    setSelectedRequest(req);
    if (req === 'WALKIN') {
      setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]); // Default 14 days
    } else {
      setDueDate(req.requiredUntil?.slice(0, 10) || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    }
    setScanError('');
  };

  // Step 3: Handle scanning the physical equipment QR code on the item
  const handleScanEquipmentQR = async (qrCodeScanned) => {
    setScanError('');
    let cleanQR = (qrCodeScanned || '').trim();

    // FIX: Old QR sticker labels encoded full URLs (https://labtrack.univ.edu/equipment/LT-XXX-00001)
    // Extract the asset ID from the URL path if the scanned value looks like a URL.
    if (cleanQR.startsWith('http')) {
      try {
        const url = new URL(cleanQR);
        const pathParts = url.pathname.split('/').filter(Boolean);
        // The asset ID is always the last segment of the path
        cleanQR = pathParts[pathParts.length - 1] || cleanQR;
      } catch {
        // Not a valid URL, use as-is
      }
    }

    if (!selectedRequest) {
      setScanError('Please select a request first');
      return;
    }

    try {
      const response = await apiClient.get(`/inventory/units/${cleanQR}`);
      const matchedUnit = response.data;
      const parentEquipment = equipmentList.find(e => e.id === matchedUnit.model_id);

      if (matchedUnit.status !== 'AVAILABLE') {
        setScanError(`Unit ${matchedUnit.asset_id} is currently marked as "${matchedUnit.status}". Please choose an available unit.`);
        return;
      }

      if (selectedRequest !== 'WALKIN') {
        // Validate against requested model
        const targetEq = equipmentList.find(e => e.id === selectedRequest.equipmentId);
        if (!parentEquipment || parentEquipment.id !== targetEq?.id) {
          setScanError(`Scanned unit (${matchedUnit.asset_id}) is a "${parentEquipment?.name || 'Unknown'}", but the approved request is for "${targetEq?.name}".`);
          return;
        }
      } else {
        // Walk-in: Just save the model info for display
        setWalkInModel(parentEquipment);
      }

      // Unit is valid and available!
      setScannedUnit({
        assetId: matchedUnit.asset_id,
        status: matchedUnit.status,
        condition: matchedUnit.condition,
        serialNumber: matchedUnit.serial_number
      });
      setStep(3);
    } catch (error) {
      if (error.response?.status === 404) {
        setScanError(`Asset tag "${cleanQR}" does not match any registered unit.`);
      } else {
        setScanError(`Server error verifying unit: ${error.message}`);
      }
    }
  };

  // Confirm Handover
  const handleConfirmIssue = async () => {
    if (!selectedRequest || !scannedUnit) return;

    try {
      if (selectedRequest === 'WALKIN') {
        // Dedicated walk-in endpoint
        await apiClient.post('/borrowing/walk-in', {
          asset_id: scannedUnit.assetId,
          borrower_id: borrowerUserId,
          due_date: new Date(dueDate).toISOString()
        });
        await refreshData();
        // Fallback simple alert since toast is not available
        alert(`Successfully issued unit ${scannedUnit.assetId} to borrower`);
      } else {
        // Standard issue flow
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
      }

      navigate('/transactions');
    } catch (error) {
      console.error('Issue equipment failed:', error);
      alert('Failed to issue equipment: ' + (error.response?.data?.detail || error.message));
    }
  };

  const resetFlow = () => {
    setStep(1);
    setBorrowerId('');
    setBorrowerUserId(null);
    setBorrowerApprovedRequests([]);
    setSelectedRequest(null);
    setScannedUnit(null);
    setWalkInModel(null);
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
        <div className="portal-card" style={{ backgroundColor: step === 1 ? '#eff6ff' : '#ffffff', borderColor: step === 1 ? '#3b82f6' : '#e2e8f0', marginBottom: 0, padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: step >= 1 ? '#1e40af' : '#94a3b8', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</span>
            <strong>1. Scan Borrower ID</strong>
          </div>
        </div>

        <div className="portal-card" style={{ backgroundColor: step === 2 ? '#eff6ff' : '#ffffff', borderColor: step === 2 ? '#3b82f6' : '#e2e8f0', marginBottom: 0, padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: step >= 2 ? '#1e40af' : '#94a3b8', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>2</span>
            <strong>2. Scan Equipment QR</strong>
          </div>
        </div>

        <div className="portal-card" style={{ backgroundColor: step === 3 ? '#eff6ff' : '#ffffff', borderColor: step === 3 ? '#3b82f6' : '#e2e8f0', marginBottom: 0, padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: step >= 3 ? '#1e40af' : '#94a3b8', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>3</span>
            <strong>3. Confirm Handover</strong>
          </div>
        </div>
      </div>

      {/* STEP 1: Scan Borrower ID */}
      {step === 1 && (
        <div>
          {scanError && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} /> {scanError}
            </div>
          )}

          <BarcodeScanner
            onScan={handleScanBorrower}
            title="Scan Borrower University ID Card"
            placeholder="e.g. 24CE001"
          />
        </div>
      )}

      {/* STEP 2: Select Request & Scan Equipment QR */}
      {step === 2 && (
        <div>
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
                  {borrowerApprovedRequests.length} Approved Request(s)
                </div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={resetFlow}>
              Scan Different User
            </button>
          </div>

          <div className="portal-card" style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
              1. Select Request Type:
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {borrowerApprovedRequests.map(req => {
                const isSelected = selectedRequest?.id === req.id;
                return (
                  <div key={req.id} onClick={() => handleSelectRequest(req)} style={{
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      borderRadius: '8px', padding: '1rem', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
                    </div>
                    <div>
                      <span className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}>
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Walk-in Issue Button */}
              <div onClick={() => handleSelectRequest('WALKIN')} style={{
                  border: selectedRequest === 'WALKIN' ? '2px solid #10b981' : '1px dashed #94a3b8',
                  backgroundColor: selectedRequest === 'WALKIN' ? '#ecfdf5' : '#f8fafc',
                  borderRadius: '8px', padding: '1rem', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} color={selectedRequest === 'WALKIN' ? '#059669' : '#64748b'} />
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: selectedRequest === 'WALKIN' ? '#065f46' : '#334155' }}>
                      Walk-in Ad-hoc Issue
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
                    Issue any available equipment instantly without a prior online request.
                  </div>
                </div>
                <div>
                  <span className={`btn btn-sm ${selectedRequest === 'WALKIN' ? 'btn-primary' : 'btn-secondary'}`} style={{ backgroundColor: selectedRequest === 'WALKIN' ? '#10b981' : undefined, borderColor: selectedRequest === 'WALKIN' ? '#10b981' : undefined }}>
                    {selectedRequest === 'WALKIN' ? 'Selected' : 'Proceed as Walk-in'}
                  </span>
                </div>
              </div>
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
                title={selectedRequest === 'WALKIN' ? "Scan Physical Asset QR to Issue" : `Scan Physical Asset QR on "${selectedRequest.equipmentName}"`}
                placeholder="e.g. LT-IOT-MC-00001"
              />
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>BORROWER</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedRequest === 'WALKIN' ? borrowerId : selectedRequest.requesterName}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>EQUIPMENT MODEL</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                {selectedRequest === 'WALKIN' ? walkInModel?.name : selectedRequest.equipmentName}
              </div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe', gridColumn: 'span 2' }}>
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
              Ensure this matches the policy limit (14 days for students).
            </small>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleConfirmIssue} style={{ flex: 1 }}>
              <CheckCircle2 size={16} /> Complete Physical Handover
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
