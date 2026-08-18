import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, CheckCircle2 } from 'lucide-react';

export const QRPrintSheet = ({ items = [], onClose, title = 'Equipment QR Code Label Sheet' }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.5rem',
        overflowY: 'auto'
      }}
      className="qr-print-modal"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '900px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header toolbar (Hidden during print) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {title}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
              Generated {items.length} individual asset label{items.length === 1 ? '' : 's'} (Ready for A4 Avery 3x8 Sheet)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} /> Print QR Stickers
            </button>
            {onClose && (
              <button className="btn btn-secondary" onClick={onClose}>
                <X size={16} /> Close
              </button>
            )}
          </div>
        </div>

        {/* Printable Area */}
        <div
          id="printable-labels-area"
          style={{
            padding: '1.5rem',
            backgroundColor: '#ffffff',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem'
          }}
        >
          {items.map((item, idx) => {
            const assetId = item.assetId || item.id || `LT-EQ-${idx + 1}`;
            const qrPayload = item.qrCodeUrl || `https://labtrack.univ.edu/equipment/${assetId}`;

            return (
              <div
                key={assetId}
                className="qr-sticker-label"
                style={{
                  border: '1.5px dashed #94a3b8',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: '#ffffff',
                  pageBreakInside: 'avoid'
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <QRCodeSVG value={qrPayload} size={64} level="H" />
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    LABTRACK ASSET
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', margin: '2px 0' }}>
                    {assetId}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#334155',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={item.name}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    {item.labName || item.labId || 'Lab Asset'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global CSS for Print Mode */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .qr-print-modal, .qr-print-modal * {
            visibility: visible;
          }
          .qr-print-modal {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: none !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-labels-area {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8mm !important;
            padding: 5mm !important;
          }
          .qr-sticker-label {
            border: 1px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
};
