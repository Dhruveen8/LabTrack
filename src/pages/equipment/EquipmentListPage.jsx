import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { QRPrintSheet } from '../../components/scanner/QRPrintSheet';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Upload, Eye, Trash2, Printer, Layers, QrCode } from 'lucide-react';

export const EquipmentListPage = () => {
  const { user } = useAuth();
  const { equipmentList, labsList, deleteEquipment } = useLabTrack();

  const [selectedLabId, setSelectedLabId] = useState('ALL');
  const [viewMode, setViewMode] = useState('MODELS'); // 'MODELS' | 'UNITS'
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [printUnits, setPrintUnits] = useState([]);

  const isAssistant = user?.role === 'assistant';
  const assignedLabIds = user?.assignedLabIds || [];

  // Filter equipment
  let filteredList = equipmentList;
  if (isAssistant && assignedLabIds.length > 0 && selectedLabId === 'ALL') {
    filteredList = equipmentList.filter(e => assignedLabIds.includes(e.labId));
  } else if (selectedLabId !== 'ALL') {
    filteredList = equipmentList.filter(e => e.labId === selectedLabId);
  }

  // Build flattened units list if in 'UNITS' mode
  const allUnitsList = [];
  filteredList.forEach(eq => {
    if (eq.units) {
      eq.units.forEach(u => {
        allUnitsList.push({
          ...u,
          modelId: eq.id,
          modelName: eq.name,
          category: eq.category,
          labName: eq.labName,
          labId: eq.labId
        });
      });
    }
  });

  const handlePrintModelQR = (row) => {
    if (row.units && row.units.length > 0) {
      setPrintUnits(row.units);
      setShowPrintSheet(true);
    }
  };

  const handlePrintAllVisible = () => {
    const unitsToPrint = [];
    filteredList.forEach(eq => {
      if (eq.units) unitsToPrint.push(...eq.units);
    });
    setPrintUnits(unitsToPrint);
    setShowPrintSheet(true);
  };

  const modelColumns = [
    {
      header: 'Model ID',
      accessor: 'id',
      cell: (row) => (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e40af' }}>
          {row.id}
        </span>
      )
    },
    { header: 'Equipment Name', accessor: 'name' },
    { header: 'Category', accessor: 'category' },
    { header: 'Laboratory', accessor: 'labName' },
    {
      header: 'Units (Available / Total)',
      cell: (row) => (
        <div>
          <strong style={{ color: '#15803d' }}>{row.availableQuantity}</strong>
          <span style={{ color: '#64748b' }}> / {row.quantity} units</span>
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <Link to={`/equipment/${row.id}`} className="btn btn-secondary btn-sm" title="View Details & Units">
            <Eye size={13} /> View
          </Link>
          <button
            className="btn btn-secondary btn-sm"
            title="Print QR Codes for all units of this model"
            onClick={() => handlePrintModelQR(row)}
          >
            <Printer size={13} /> QR
          </button>
          {isAssistant && (
            <button className="btn btn-danger btn-sm" title="Delete" onClick={() => deleteEquipment(row.id)}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )
    }
  ];

  const unitColumns = [
    {
      header: 'Asset QR Tag ID',
      accessor: 'assetId',
      cell: (row) => (
        <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#1e40af' }}>
          {row.assetId}
        </span>
      )
    },
    { header: 'Equipment Name', accessor: 'name' },
    { header: 'Laboratory', accessor: 'labName' },
    { header: 'Condition', accessor: 'condition' },
    {
      header: 'Unit Status',
      cell: (row) => (
        <span className={`badge ${row.status === 'Available' ? 'badge-success' : 'badge-warning'}`}>
          {row.status}
        </span>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <Link to={`/equipment/${row.assetId}`} className="btn btn-secondary btn-sm">
            <Eye size={13} />
          </Link>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setPrintUnits([row]);
              setShowPrintSheet(true);
            }}
          >
            <Printer size={13} /> Print
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="University Equipment Directory"
        subtitle="Manage hardware models, monitor real-time unit availability, and print physical QR code sticker sheets"
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handlePrintAllVisible}>
              <Printer size={14} /> Print QR Stickers ({allUnitsList.length})
            </button>
            <Link to="/equipment/add" className="btn btn-primary">
              <Plus size={14} /> Add Equipment
            </Link>
            <Link to="/bulk-import" className="btn btn-secondary">
              <Upload size={14} /> Bulk Import CSV
            </Link>
          </div>
        }
      />

      {/* Control bar: Lab Filter & View Mode */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Filter Lab:</label>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '220px' }}
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
          >
            <option value="ALL">All Managed Laboratories</option>
            {labsList.map(lab => (
              <option key={lab.id} value={lab.id}>{lab.name} ({lab.id})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '6px' }}>
          <button
            className={`btn btn-sm ${viewMode === 'MODELS' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
            onClick={() => setViewMode('MODELS')}
          >
            <Layers size={13} /> View by Model ({filteredList.length})
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'UNITS' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
            onClick={() => setViewMode('UNITS')}
          >
            <QrCode size={13} /> View by Asset Tag ({allUnitsList.length})
          </button>
        </div>
      </div>

      <div className="portal-card">
        {viewMode === 'MODELS' ? (
          <DataTable columns={modelColumns} data={filteredList} />
        ) : (
          <DataTable columns={unitColumns} data={allUnitsList} />
        )}
      </div>

      {showPrintSheet && (
        <QRPrintSheet
          items={printUnits}
          title={`Equipment QR Sticker Print Grid (${printUnits.length} Labels)`}
          onClose={() => setShowPrintSheet(false)}
        />
      )}
    </div>
  );
};
