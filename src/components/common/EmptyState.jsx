import React from 'react';
import { PackageX } from 'lucide-react';

export const EmptyState = ({ title = 'No data available', message = 'There are no items matching your criteria at this time.', action }) => {
  return (
    <div
      style={{
        padding: '3rem 1.5rem',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        margin: '1rem 0'
      }}
    >
      <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#64748b', marginBottom: '1rem' }}>
        <PackageX size={32} />
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.35rem' }}>{title}</h3>
      <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '400px', margin: '0 auto 1.25rem' }}>{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
