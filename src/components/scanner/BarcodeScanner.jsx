import React, { useState } from 'react';
import { Camera, Scan, CheckCircle2 } from 'lucide-react';

export const BarcodeScanner = ({ onScan, title = 'Scan Code', placeholder = 'Enter ID or click Demo Scan', mockDataToReturn }) => {
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState(null);

  const handleDemoScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const code = mockDataToReturn || manualInput || 'STU-2024-884';
      setScannedResult(code);
      if (onScan) onScan(code);
    }, 800);
  };

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

      {/* Visual Scanner Viewfinder */}
      <div
        style={{
          position: 'relative',
          height: '160px',
          backgroundColor: '#0f172a',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: '1rem',
          color: '#ffffff'
        }}
      >
        {/* Scanner laser overlay */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: '#3b82f6',
            boxShadow: '0 0 10px #3b82f6',
            top: isScanning ? '80%' : '20%',
            transition: 'top 0.8s ease-in-out'
          }}
        />

        {/* Viewfinder Bounding Box */}
        <div
          style={{
            width: '200px',
            height: '100px',
            border: '2px solid rgba(255,255,255,0.4)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)'
          }}
        >
          {scannedResult ? (
            <div style={{ textAlign: 'center', color: '#4ade80' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 4px' }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Scanned: {scannedResult}</div>
            </div>
          ) : (
            <Scan size={36} style={{ opacity: 0.6 }} />
          )}
        </div>
        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#94a3b8' }}>
          {isScanning ? 'Processing Barcode Scan...' : 'Position Barcode / QR Code inside frame'}
        </div>
      </div>

      {/* Control Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDemoScan}
          disabled={isScanning}
          style={{ flex: 1 }}
        >
          <Scan size={16} /> {isScanning ? 'Scanning...' : 'Demo Scan'}
        </button>

        <form onSubmit={handleManualSubmit} style={{ flex: 2, display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="form-control"
            placeholder={placeholder}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
};
