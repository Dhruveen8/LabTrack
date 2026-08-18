import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export const QRCodeDisplay = ({ value, title = 'Equipment QR Code', size = 130, subtitle = '' }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <div
        style={{
          padding: '8px',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <QRCodeSVG
          value={value || 'LT-GEN-00000'}
          size={size}
          level="H"
          includeMargin={false}
        />
      </div>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '0.65rem', fontFamily: 'monospace' }}>
        {value || 'N/A'}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>{title}</div>
      {subtitle && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{subtitle}</div>}
    </div>
  );
};
