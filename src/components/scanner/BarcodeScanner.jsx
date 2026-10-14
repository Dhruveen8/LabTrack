import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, RotateCcw } from 'lucide-react';
import { getScanBox } from '../../utils/scannerConfig';

export const BarcodeScanner = ({ onScan, title = 'Scan Code', placeholder = 'Enter ID manually', scanMode = 'equipment' }) => {
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const stopScannerRef = useRef(() => Promise.resolve());
  const cleanupRef = useRef(Promise.resolve());
  const [scanAttempt, setScanAttempt] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    // Generate a unique ID for the scanner container to allow multiple instances
    const scannerId = `qr-reader-${Math.random().toString(36).substr(2, 9)}`;
    if (!scannerRef.current) return;

    let cancelled = false;
    let accepted = false;
    let html5QrcodeScanner;
    let clearPromise;
    const stop = () => {
      if (!html5QrcodeScanner) return Promise.resolve();
      if (!clearPromise) {
        clearPromise = html5QrcodeScanner.clear().catch(error => {
          console.error('Failed to clear barcode scanner.', error);
        });
      }
      return clearPromise;
    };

    // Await the previous camera teardown before mounting another scanner.
    cleanupRef.current.then(() => {
      if (cancelled) return;
      scannerRef.current.id = scannerId;
      html5QrcodeScanner = new Html5QrcodeScanner(
        scannerId,
        {
          fps: 10,
          qrbox: (width, height) => getScanBox(width, height, scanMode),
          ...(scanMode === 'id' ? { formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.QR_CODE,
          ] } : {}),
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
        },
        /* verbose= */ false
      );

      const handleScanSuccess = (decodedText) => {
        const value = decodedText.trim();
        if (cancelled || accepted || !value) return;
        accepted = true;
        setScannedResult(value);
        cleanupRef.current = stop();
        onScanRef.current?.(value);
      };

      const handleScanFailure = (_error) => {
        // Ignored: html5-qrcode continuously fires this while seeking a barcode
      };

      html5QrcodeScanner.render(handleScanSuccess, handleScanFailure);
      stopScannerRef.current = () => {
        accepted = true;
        cleanupRef.current = stop();
        return cleanupRef.current;
      };
    });

    return () => {
      cancelled = true;
      cleanupRef.current = stop();
    };
  }, [scanMode, scanAttempt]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      setScannedResult(manualInput.trim());
      stopScannerRef.current();
      onScanRef.current?.(manualInput.trim());
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
            <div style={{ fontSize: '1rem', fontWeight: 700, overflowWrap: 'anywhere', maxWidth: '100%', padding: '0 1rem' }}>Scanned: {scannedResult}</div>
            <button type="button" className="btn btn-secondary btn-sm" title="Scan again" style={{ marginTop: '1rem' }} onClick={async () => {
              await cleanupRef.current;
              setScannedResult(null);
              setManualInput('');
              setScanAttempt(attempt => attempt + 1);
            }}>
              <RotateCcw size={14} /> Scan Again
            </button>
          </div>
        ) : null}
        <div ref={scannerRef} style={{ display: scannedResult ? 'none' : 'block', width: '100%', overflow: 'hidden', borderRadius: '6px' }}></div>
      </div>

      {/* Manual Entry Fallback */}
      <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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
