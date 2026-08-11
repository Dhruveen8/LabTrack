import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { Package, Send, Eye } from 'lucide-react';

export const BrowseEquipmentPage = () => {
  const { equipmentList } = useLabTrack();

  return (
    <div>
      <PageHeader title="Browse University Equipment Catalog" subtitle="Search hardware, microcontrollers, and measurement instruments available across all labs" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {equipmentList.map(item => (
          <div key={item.id} className="portal-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                  {item.id}
                </span>
                <StatusBadge status={item.status} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{item.name}</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>{item.labName}</p>
              <div style={{ fontSize: '0.8rem', color: '#334155', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                <span>Available: <strong>{item.availableQuantity}</strong> / {item.quantity}</span>
                <span>Category: <strong>{item.category}</strong></span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Link to={`/equipment/${item.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                <Eye size={14} /> Details
              </Link>
              <Link to={`/request-equipment?id=${item.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                <Send size={14} /> Request
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
