import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLabTrack } from '../../context/LabTrackContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { QRCodeDisplay } from '../../components/scanner/QRCodeDisplay';
import { ArrowLeft, Package, Building2, Calendar, Tag } from 'lucide-react';

export const EquipmentDetailPage = () => {
  const { id } = useParams();
  const { equipmentList } = useLabTrack();
  const item = equipmentList.find(e => e.id === id) || equipmentList[0];

  return (
    <div>
      <PageHeader
        title={item.name}
        subtitle={`Asset Tag ID: ${item.id} | Lab: ${item.labName}`}
        actions={
          <Link to="/equipment" className="btn btn-secondary">
            <ArrowLeft size={14} /> Back to Equipment List
          </Link>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">Asset Technical Specifications</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem', color: '#334155' }}>
            <div><strong>Equipment ID:</strong> {item.id}</div>
            <div><strong>Category:</strong> {item.category}</div>
            <div><strong>Location Lab:</strong> {item.labName}</div>
            <div><strong>Condition:</strong> {item.condition}</div>
            <div><strong>Total Units:</strong> {item.quantity}</div>
            <div><strong>Available Units:</strong> {item.availableQuantity}</div>
            <div><strong>Borrowed Units:</strong> {item.borrowedQuantity || 0}</div>
            <div><strong>Status:</strong> <StatusBadge status={item.status} /></div>
          </div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <strong>Description:</strong>
            <p style={{ marginTop: '0.25rem', color: '#64748b' }}>{item.description || 'Standard university laboratory asset.'}</p>
          </div>
        </div>

        <div className="portal-card" style={{ textAlign: 'center' }}>
          <div className="portal-header">
            <div className="portal-title">QR Asset Tag</div>
          </div>
          <QRCodeDisplay value={item.qrCode || item.id} title={`QR Tag: ${item.id}`} />
        </div>
      </div>
    </div>
  );
};
