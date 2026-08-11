import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { useLabTrack } from '../../context/LabTrackContext';
import { Upload, FileSpreadsheet, CheckCircle2, Download, AlertCircle } from 'lucide-react';

export const BulkImportPage = () => {
  const { addEquipment } = useLabTrack();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [validated, setValidated] = useState(false);

  const mockFileSelect = () => {
    setSelectedFile('university_equipment_import_template.csv');
    setPreviewData([
      { id: 'EQ-2001', name: 'STM32 Nucleo-64 Board', category: 'Microcontrollers', labName: 'IoT & Embedded Systems Lab', quantity: 15, valid: true },
      { id: 'EQ-2002', name: 'Keysight 200MHz Oscilloscope', category: 'Testing & Measurement', labName: 'Electronics & VLSI Lab', quantity: 4, valid: true },
      { id: 'EQ-2003', name: 'Logic Analyzer 16 Channel', category: 'Testing & Measurement', labName: 'Electronics & VLSI Lab', quantity: 8, valid: true },
      { id: 'EQ-2004', name: 'LiDAR Sensor Module v2', category: 'Robotics', labName: 'Robotics & Automation Lab', quantity: 2, valid: false }
    ]);
  };

  const handleValidate = () => {
    setValidated(true);
  };

  const handleImport = async () => {
    for (const item of previewData.filter(i => i.valid)) {
      await addEquipment({
        id: item.id,
        name: item.name,
        category: item.category,
        labId: 'LAB-IOT',
        labName: item.labName,
        quantity: item.quantity,
        condition: 'Excellent',
        status: 'Available'
      });
    }
    alert(`Successfully imported ${previewData.filter(i => i.valid).length} valid equipment records!`);
  };

  const columns = [
    { header: 'Equipment ID', accessor: 'id' },
    { header: 'Equipment Name', accessor: 'name' },
    { header: 'Category', accessor: 'category' },
    { header: 'Target Lab', accessor: 'labName' },
    { header: 'Qty', accessor: 'quantity' },
    {
      header: 'Validation',
      cell: (row) => (
        <span className={`badge ${row.valid ? 'badge-success' : 'badge-danger'}`}>
          {row.valid ? 'Valid Record' : 'Invalid / Duplicate ID'}
        </span>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Bulk Equipment CSV / Excel Import" subtitle="Upload spreadsheet files to register multiple lab equipment records simultaneously" />

      <div className="portal-card">
        <div
          onClick={mockFileSelect}
          style={{
            border: '2px dashed #3b82f6',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            padding: '2.5rem',
            textAlign: 'center',
            cursor: 'pointer'
          }}
        >
          <Upload size={36} color="#1e40af" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            {selectedFile ? `Selected File: ${selectedFile}` : 'Drag & Drop CSV / Excel file here'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 1rem' }}>
            Click to browse your local computer drive
          </p>
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); alert('Downloading template.csv'); }}>
            <Download size={14} /> Download Sample Template
          </button>
        </div>

        {previewData.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            {/* Record summary pill strip */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="badge badge-info" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>Total: {previewData.length}</div>
              <div className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>Valid: {previewData.filter(i => i.valid).length}</div>
              <div className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>Invalid: {previewData.filter(i => !i.valid).length}</div>
            </div>

            <DataTable columns={columns} data={previewData} />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={handleValidate}>
                <CheckCircle2 size={16} /> Validate File Data
              </button>
              <button className="btn btn-primary" onClick={handleImport}>
                <Upload size={16} /> Import Valid Records ({previewData.filter(i => i.valid).length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
