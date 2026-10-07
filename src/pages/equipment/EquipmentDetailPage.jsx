import { useLabTrack, useAuth } from '../../context/hooks';
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { QRCodeDisplay } from '../../components/scanner/QRCodeDisplay';
import { QRPrintSheet } from '../../components/scanner/QRPrintSheet';
import { ArrowLeft, Printer } from 'lucide-react';

export const EquipmentDetailPage = () => {
  const { id } = useParams();
  const { equipmentList, loading } = useLabTrack();
  const { user } = useAuth();
  // --- NR-1: Only admin/assistant can print QR ---
  const canPrintQR = user?.role === 'admin' || user?.role === 'assistant';

  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [printUnits, setPrintUnits] = useState([]);

  // Match by equipment id or unit asset id
  let item = equipmentList.find(e => e.id.toString() === id.toString());
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

  // FIX: Don't silently show a random item — show a proper not-found message
  // Also handle the loading state (equipmentList is empty while fetching)

  if (loading) {
    return (
      <div className="portal-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#64748b' }}>Loading equipment data...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="portal-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Equipment Not Found</h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>No equipment record matches the ID: <code>{id}</code></p>
        <Link to="/equipment" className="btn btn-secondary">← Back to Equipment List</Link>
      </div>
    );
  }

  const units = item?.units || [];
  const primaryAssetId = highlightedUnit?.assetId || units[0]?.assetId || item?.id;

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
            {canPrintQR && (
              <button className="btn btn-primary" onClick={handlePrintAllQR}>
                <Printer size={14} /> Print All {units.length} QR Stickers
              </button>
            )}
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

        {canPrintQR && (
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
        )}
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
                {canPrintQR && <th>Actions</th>}
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
                    {canPrintQR && (
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handlePrintSingleQR(unit)}
                        >
                          <Printer size={13} /> Print QR
                        </button>
                      </td>
                    )}
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
