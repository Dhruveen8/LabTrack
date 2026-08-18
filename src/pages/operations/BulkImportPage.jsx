import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { QRPrintSheet } from '../../components/scanner/QRPrintSheet';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Upload, FileSpreadsheet, CheckCircle2, Download, AlertCircle, Printer, Sparkles } from 'lucide-react';

export const BulkImportPage = () => {
  const { user } = useAuth();
  const { labsList, bulkAddEquipment } = useLabTrack();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [validated, setValidated] = useState(false);
  const [importedUnits, setImportedUnits] = useState([]);
  const [showPrintSheet, setShowPrintSheet] = useState(false);

  const mockFileSelect = () => {
    setSelectedFile('university_lab_bulk_equipment.csv');
    setPreviewData([
      {
        name: 'STM32 Nucleo-64 Board',
        category: 'Microcontrollers',
        labId: 'LAB-IOT',
        labName: 'IoT & Embedded Systems Lab',
        quantity: 10,
        condition: 'Excellent',
        serialNumber: 'STM32-NUC',
        description: 'ARM Cortex-M4 development board with ST-LINK/V2-1 debugger',
        valid: true
      },
      {
        name: 'Keysight 200MHz Oscilloscope',
        category: 'Testing & Measurement',
        labId: 'LAB-ECE',
        labName: 'Electronics & VLSI Lab',
        quantity: 4,
        condition: 'Good',
        serialNumber: 'KEY-DSOX',
        description: '2-channel digital storage oscilloscope',
        valid: true
      },
      {
        name: 'Logic Analyzer 16 Channel',
        category: 'Testing & Measurement',
        labId: 'LAB-ECE',
        labName: 'Electronics & VLSI Lab',
        quantity: 6,
        condition: 'Excellent',
        serialNumber: 'LOGIC-16',
        description: 'USB logic analyzer for digital protocol decoding',
        valid: true
      },
      {
        name: 'LiDAR Sensor Module v2',
        category: 'Robotics',
        labId: 'LAB-ROB',
        labName: 'Robotics & Automation Lab',
        quantity: 3,
        condition: 'Excellent',
        serialNumber: 'LIDAR-V2',
        description: '360 degree laser distance scanner module',
        valid: true
      }
    ]);
    setValidated(true);
  };

  const handleImport = async () => {
    const validItems = previewData.filter(i => i.valid);
    if (validItems.length === 0) return alert('No valid records to import');

    const createdItems = await bulkAddEquipment(validItems);

    // Collect all generated units for QR printing
    const allUnits = [];
    createdItems.forEach(item => {
      if (item.units) {
        allUnits.push(...item.units);
      }
    });

    setImportedUnits(allUnits);
    setShowPrintSheet(true);
  };

  const downloadSampleCSV = (e) => {
    e.stopPropagation();
    const csvContent = "data:text/csv;charset=utf-8," +
      "name,category,labId,quantity,condition,serialNumber,description\n" +
      "\"Arduino Uno R3 Kit\",\"Microcontrollers\",\"LAB-IOT\",10,\"Excellent\",\"ARD-UNO\",\"ATmega328P kit\"\n" +
      "\"Digital Multimeter\",\"Testing & Measurement\",\"LAB-ECE\",5,\"Good\",\"FLU-87\",\"Industrial DMM\"";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "labtrack_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { header: 'Equipment Model', accessor: 'name' },
    { header: 'Category', accessor: 'category' },
    { header: 'Target Laboratory', accessor: 'labName' },
    {
      header: 'Units Qty',
      accessor: 'quantity',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#1e40af' }}>
          {row.quantity} units ➔ {row.quantity} QR tags
        </span>
      )
    },
    {
      header: 'Validation',
      cell: (row) => (
        <span className={`badge ${row.valid ? 'badge-success' : 'badge-danger'}`}>
          {row.valid ? '✓ Ready to Generate Asset IDs' : 'Invalid Record'}
        </span>
      )
    }
  ];

  const totalUnitsToCreate = previewData.reduce((acc, curr) => acc + (curr.valid ? curr.quantity : 0), 0);

  return (
    <div>
      <PageHeader
        title="Bulk Equipment CSV / Excel Import"
        subtitle="Upload spreadsheet batches to register equipment. The system automatically creates unique unit Asset IDs & printable QR tags."
      />

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
            {selectedFile ? `Loaded: ${selectedFile}` : 'Click to Select or Drag & Drop Equipment CSV / Excel File'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 1rem' }}>
            {selectedFile ? 'Click "Import Records & Generate QR Labels" below' : 'Click to load sample university equipment spreadsheet dataset'}
          </p>
          <button className="btn btn-secondary btn-sm" onClick={downloadSampleCSV}>
            <Download size={14} /> Download Sample CSV Template
          </button>
        </div>

        {previewData.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            {/* Record summary strip */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="badge badge-info" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                Models: {previewData.length}
              </div>
              <div className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                Total Asset Units to Generate: {totalUnitsToCreate}
              </div>
            </div>

            <DataTable columns={columns} data={previewData} />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-primary" onClick={handleImport}>
                <Sparkles size={16} /> Import & Generate {totalUnitsToCreate} Asset QR Codes
              </button>
              <button className="btn btn-secondary" onClick={() => { setPreviewData([]); setSelectedFile(null); }}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Print Sheet modal after bulk import */}
      {showPrintSheet && importedUnits.length > 0 && (
        <QRPrintSheet
          items={importedUnits}
          title={`Bulk QR Code Print Sheet (${importedUnits.length} Asset Labels)`}
          onClose={() => setShowPrintSheet(false)}
        />
      )}
    </div>
  );
};
