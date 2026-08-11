import React from 'react';
import { QrCode } from 'lucide-react';

export const QRCodeDisplay = ({ value, title = 'Equipment QR Code', size = 120 }) => {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: '#0f172a',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          padding: '8px',
          boxShadow: 'inset 0 0 10px rgba(255,255,255,0.1)'
        }}
      >
        <QrCode size={size * 0.7} color="#ffffff" />
      </div>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginTop: '0.5rem' }}>
        {value || 'N/A'}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{title}</div>
    </div>
  );
};
