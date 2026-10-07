import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, CheckCircle2 } from 'lucide-react';

export const BarcodeScanner = ({ onScan, title = 'Scan Code', placeholder = 'Enter ID manually' }) => {
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    // Generate a unique ID for the scanner container to allow multiple instances
    const scannerId = `qr-reader-${Math.random().toString(36).substr(2, 9)}`;
    if (!scannerRef.current) return;
    scannerRef.current.id = scannerId;

    const html5QrcodeScanner = new Html5QrcodeScanner(
      scannerId,
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
      /* verbose= */ false
    );

    const handleScanSuccess = (decodedText) => {
      setScannedResult(decodedText);
      html5QrcodeScanner.clear(); // Stop scanning after success
      if (onScan) onScan(decodedText);
    };

    const handleScanFailure = (_error) => {
      // Ignored: html5-qrcode continuously fires this while seeking a barcode
    };

    html5QrcodeScanner.render(handleScanSuccess, handleScanFailure);

    return () => {
      html5QrcodeScanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, [onScan]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      setScannedResult(manualInput.trim());
      if (onScan) onScan(manualInput.trim());
    }
  };

  return (
    <div className="portal-card" style={{ border: '2px dashed #bfdbfe', backgroundColor: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Camera size={18} style={{ color: '#1e40af' }} />
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>{title}</h4>
      </div>

      {/* Visual Scanner Viewfinder or Success State */}
      <div style={{ marginBottom: '1rem', minHeight: '260px' }}>
        {scannedResult ? (
          <div style={{
            height: '260px',
            backgroundColor: '#0f172a',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4ade80'
          }}>
            <CheckCircle2 size={48} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>Scanned: {scannedResult}</div>
          </div>
        ) : (
          <div ref={scannerRef} style={{ width: '100%', overflow: 'hidden', borderRadius: '6px' }}></div>
        )}
      </div>

      {/* Manual Entry Fallback */}
      <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary">
          Enter Manually
        </button>
      </form>
    </div>
  );
};
