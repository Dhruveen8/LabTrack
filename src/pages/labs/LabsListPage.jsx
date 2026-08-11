import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { Building2, Package, CheckCircle, Clock, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LabsListPage = () => {
  const { labsList } = useLabTrack();

  return (
    <div>
      <PageHeader title="University Laboratory Directory" subtitle="Overview of specialized research facilities and lab equipment distribution" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {labsList.map(lab => (
          <div key={lab.id} className="portal-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af', marginBottom: '0.35rem' }}>
                <Building2 size={20} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{lab.id}</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{lab.name}</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>{lab.location}</p>
              <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '1rem' }}>{lab.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                <div>Total Equipment: <strong>{lab.totalEquipment}</strong></div>
                <div>Available: <strong style={{ color: '#15803d' }}>{lab.available}</strong></div>
                <div>Borrowed: <strong style={{ color: '#1e40af' }}>{lab.borrowed}</strong></div>
                <div>Maintenance: <strong style={{ color: '#b45309' }}>{lab.maintenance}</strong></div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <Link to={`/equipment?lab=${lab.id}`} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                View Lab Inventory ({lab.totalEquipment} Items)
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
