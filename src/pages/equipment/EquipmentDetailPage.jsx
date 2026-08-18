import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLabTrack } from '../../context/LabTrackContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { QRCodeDisplay } from '../../components/scanner/QRCodeDisplay';
import { QRPrintSheet } from '../../components/scanner/QRPrintSheet';
import { ArrowLeft, Package, Building2, Calendar, Tag, Printer, QrCode } from 'lucide-react';

export const EquipmentDetailPage = () => {
  const { id } = useParams();
  const { equipmentList } = useLabTrack();

  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [printUnits, setPrintUnits] = useState([]);

  // Match by equipment id or unit asset id
  let item = equipmentList.find(e => e.id === id);
  let highlightedUnit = null;

  if (!item) {
    for (const eq of equipmentList) {
      if (eq.units) {
        const u = eq.units.find(unit => unit.assetId === id);
        if (u) {
          item = eq;
          highlightedUnit = u;
          break;
        }
      }
    }
  }

  if (!item) {
    item = equipmentList[0];
  }

  const units = item?.units || [];
  const primaryAssetId = highlightedUnit?.assetId || units[0]?.assetId || item.id;

  const handlePrintAllQR = () => {
    setPrintUnits(units);
    setShowPrintSheet(true);
  };

  const handlePrintSingleQR = (unit) => {
    setPrintUnits([unit]);
    setShowPrintSheet(true);
  };

  return (
    <div>
      <PageHeader
        title={item.name}
        subtitle={`Model ID: ${item.id} | Laboratory: ${item.labName}`}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handlePrintAllQR}>
              <Printer size={14} /> Print All {units.length} QR Stickers
            </button>
            <Link to="/equipment" className="btn btn-secondary">
              <ArrowLeft size={14} /> Back to Equipment List
            </Link>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">Hardware Specifications & Overview</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem', color: '#334155' }}>
            <div><strong>Equipment Model ID:</strong> {item.id}</div>
            <div><strong>Category:</strong> {item.category}</div>
            <div><strong>Location Lab:</strong> {item.labName}</div>
            <div><strong>Overall Condition:</strong> {item.condition}</div>
            <div><strong>Total Units Registered:</strong> <strong>{item.quantity}</strong></div>
            <div><strong>Available Units:</strong> <strong style={{ color: '#15803d' }}>{item.availableQuantity}</strong></div>
            <div><strong>Currently Borrowed:</strong> <strong style={{ color: '#1e40af' }}>{item.borrowedQuantity || 0}</strong></div>
            <div><strong>Model Status:</strong> <StatusBadge status={item.status} /></div>
          </div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <strong>Description:</strong>
            <p style={{ marginTop: '0.25rem', color: '#64748b' }}>{item.description || 'Standard university laboratory asset.'}</p>
          </div>
        </div>

        <div className="portal-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="portal-header" style={{ width: '100%' }}>
            <div className="portal-title">Primary Asset QR Tag</div>
          </div>
          <QRCodeDisplay
            value={primaryAssetId}
            title={item.name}
            subtitle={item.labName}
            size={140}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrintAllQR}
            style={{ marginTop: '0.75rem' }}
          >
            <Printer size={13} /> Print Label Grid
          </button>
        </div>
      </div>

      {/* Individual Registered Units Table */}
      <div className="portal-card">
        <div className="portal-header">
          <div className="portal-title">
            Registered Physical Units & Asset IDs ({units.length} Units)
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Unit Asset ID</th>
                <th>Physical Serial Number</th>
                <th>Condition</th>
                <th>Current Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const isHighlight = highlightedUnit?.assetId === unit.assetId;
                return (
                  <tr key={unit.assetId} style={{ backgroundColor: isHighlight ? '#eff6ff' : 'transparent' }}>
                    <td>
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#1e40af' }}>
                        {unit.assetId}
                      </span>
                    </td>
                    <td>{unit.serialNumber || 'N/A'}</td>
                    <td>{unit.condition || 'Excellent'}</td>
                    <td>
                      <span className={`badge ${unit.status === 'Available' ? 'badge-success' : 'badge-warning'}`}>
                        {unit.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePrintSingleQR(unit)}
                      >
                        <Printer size={13} /> Print QR
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showPrintSheet && (
        <QRPrintSheet
          items={printUnits}
          title={`QR Sticker Labels for ${item.name}`}
          onClose={() => setShowPrintSheet(false)}
        />
      )}
    </div>
  );
};
