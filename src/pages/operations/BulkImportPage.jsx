import { useLabTrack, useAuth } from '../../context/hooks';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { QRPrintSheet } from '../../components/scanner/QRPrintSheet';
import { Upload, Download, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';

export const BulkImportPage = () => {
  const { user } = useAuth();
  const { labsList, bulkImportExcelEquipment } = useLabTrack();
  const fileInputRef = useRef(null);

  const importLock = useRef(false);
  const [targetLabId, setTargetLabId] = useState('');
  const eligibleLabs = useMemo(
    () => labsList.filter(lab => user?.role === 'admin' || user?.assignedLabIds?.includes(lab.id)),
    [labsList, user]
  );
  useEffect(() => {
    if (!eligibleLabs.some(lab => String(lab.id) === targetLabId)) {
      setTargetLabId(eligibleLabs.length ? String(eligibleLabs[0].id) : '');
    }
  }, [eligibleLabs, targetLabId]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [importedUnits, setImportedUnits] = useState([]);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file) => {
    if (!file || importLock.current) return;
    setPreviewData([]);

    setSelectedFile(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      const parsed = json.map(row => {
        const name = row['Equipment Model / Name'] || row.name || '';
        const qty = Number(row['Quantity of Units'] ?? row.quantity ?? 1);
        const category = row['Category'] || row.category || 'GEN';
        const serialPrefix = row['Manufacturer Serial No. Prefix'] || row.serialPrefix || '';
        const condition = row['Initial Physical Condition'] || row.condition || 'Excellent';
        const description = row['Description / Specifications'] || row.description || '';

        return {
          name,
          category,
          quantity: qty,
          serial_prefix: serialPrefix,
          condition,
          description,
          valid: !!name && Number.isInteger(qty) && qty > 0 && qty <= 10000
        };
      });
      setPreviewData(parsed);
    } catch (e) {
      alert('Error parsing Excel file: ' + e.message);
    }
  };

  const handleFileSelect = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleImport = async () => {
    if (importLock.current || !targetLabId) return;
    const validItems = previewData.filter(i => i.valid);
    if (validItems.length === 0) return alert('No valid records to import');

    importLock.current = true;
    setIsImporting(true);
    try {
      const response = await bulkImportExcelEquipment(validItems, Number(targetLabId));
      setPreviewData([]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (response && response.units) {
        setImportedUnits(response.units);
        setShowPrintSheet(true);
      }
    } catch (e) {
      console.error("Import error:", e);
      let errMsg = 'An error occurred during bulk import';
      if (e.response?.data?.detail) {
        if (typeof e.response.data.detail === 'string') {
          errMsg = e.response.data.detail;
        } else if (Array.isArray(e.response.data.detail)) {
          errMsg = e.response.data.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
        } else {
          errMsg = JSON.stringify(e.response.data.detail);
        }
      } else if (e.message) {
        errMsg = e.message;
      }
      alert(`Error: ${errMsg}`);
    } finally {
      importLock.current = false;
      setIsImporting(false);
    }
  };

  const downloadSampleExcel = (e) => {
    e.stopPropagation();

    const data = [
      {
        'Equipment Model / Name': 'Arduino Uno R3 Kit',
        'Quantity of Units': 10,
        'Category': 'Microcontrollers',
        'Manufacturer Serial No. Prefix': 'ARD-UNO',
        'Initial Physical Condition': 'Excellent',
        'Description / Specifications': 'ATmega328P kit'
      },
      {
        'Equipment Model / Name': 'Digital Multimeter',
        'Quantity of Units': 5,
        'Category': 'Testing & Measurement',
        'Manufacturer Serial No. Prefix': 'FLU-87',
        'Initial Physical Condition': 'Good',
        'Description / Specifications': 'Industrial DMM'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipment");
    XLSX.writeFile(wb, "labtrack_bulk_import_template.xlsx");
  };

  const columns = [
    { header: 'Equipment Model', accessor: 'name' },
    { header: 'Category', accessor: 'category' },
    { header: 'Serial Prefix', accessor: 'serial_prefix' },
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
          {row.valid ? '✓ Ready to Generate Asset IDs' : 'Invalid Model or Quantity'}
        </span>
      )
    }
  ];

  const totalUnitsToCreate = previewData.reduce((acc, curr) => acc + (curr.valid ? curr.quantity : 0), 0);

  return (
    <div>
      <PageHeader
        title="Bulk Equipment Excel Import"
        subtitle="Upload spreadsheet batches to register equipment. The system automatically creates unique unit Asset IDs & printable QR tags based on your assigned laboratory."
      />

      <div className="portal-card">
        <label htmlFor="import-lab">Target laboratory</label>
        <select id="import-lab" className="form-control" value={targetLabId}
          disabled={isImporting} onChange={event => setTargetLabId(event.target.value)}
          style={{ marginBottom: '1rem' }}>
          {!eligibleLabs.length && <option value="">No assigned laboratory</option>}
          {eligibleLabs.map(lab => <option key={lab.id} value={lab.id}>
            {lab.displayId || `LAB-${lab.code}`} — {lab.name}
          </option>)}
        </select>
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileSelect} 
        />

        <div
          onClick={() => fileInputRef.current.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${isDragging ? '#10b981' : '#3b82f6'}`,
            borderRadius: '8px',
            backgroundColor: isDragging ? '#ecfdf5' : '#eff6ff',
            padding: '2.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <Upload size={36} color="#1e40af" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            {selectedFile ? `Loaded: ${selectedFile}` : 'Click to Select or Drag & Drop Equipment Excel File (.xlsx)'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 1rem' }}>
            {selectedFile ? 'Review records and click "Import Records & Generate QR Labels" below' : 'Select an Excel file to import batches of equipment'}
          </p>
          <button className="btn btn-secondary btn-sm" onClick={downloadSampleExcel}>
            <Download size={14} /> Download Sample Excel Template
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
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={isImporting || !targetLabId || totalUnitsToCreate === 0}
              >
                <Sparkles size={16} /> 
                {isImporting ? 'Importing...' : `Import & Generate ${totalUnitsToCreate} Asset QR Codes`}
              </button>
              <button
                className="btn btn-secondary"
                disabled={isImporting}
                onClick={() => { setPreviewData([]); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              >
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
