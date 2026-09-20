import React, { useState, useRef } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { QRPrintSheet } from '../../components/scanner/QRPrintSheet';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Upload, Download, Sparkles } from 'lucide-react';
import Papa from 'papaparse';

export const BulkImportPage = () => {
  const { user } = useAuth();
  const { labsList, bulkAddEquipment } = useLabTrack();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [importedUnits, setImportedUnits] = useState([]);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file) => {
    if (!file) return;

    setSelectedFile(file.name);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map(row => {
          const qty = parseInt(row.quantity, 10) || 1;
          
          // Match lab ID/Code/Name to the actual lab in the database
          const targetLab = labsList.find(l => 
            String(l.id) === String(row.labId).trim() || 
            (l.code && l.code.toLowerCase() === String(row.labId).trim().toLowerCase()) ||
            l.name.toLowerCase() === String(row.labId).trim().toLowerCase()
          );

          return {
            name: row.name || 'Unknown Equipment',
            category: row.category || 'GEN',
            labId: targetLab ? targetLab.id : row.labId, // if not found, keep string to fail validation
            labName: targetLab ? targetLab.name : `Not Found (${row.labId})`,
            quantity: qty,
            condition: row.condition || 'Excellent',
            serialNumber: row.serialNumber || '',
            description: row.description || '',
            valid: !!targetLab && !!row.name && qty > 0
          };
        });
        setPreviewData(parsed);
      },
      error: (error) => {
        alert('Error parsing CSV file: ' + error.message);
      }
    });
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
    const validItems = previewData.filter(i => i.valid);
    if (validItems.length === 0) return alert('No valid records to import');

    setIsImporting(true);
    try {
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
    } catch (e) {
      console.error(e);
      alert('An error occurred during bulk import');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleCSV = (e) => {
    e.stopPropagation();
    // Use the actual lab code from the first lab in the system, or fallback
    const sampleLabCode = labsList.length > 0 ? (labsList[0].code || labsList[0].id) : 'LAB-IOT';
    
    const csvContent = "data:text/csv;charset=utf-8," +
      "name,category,labId,quantity,condition,serialNumber,description\n" +
      `"Arduino Uno R3 Kit","Microcontrollers","${sampleLabCode}",10,"Excellent","ARD-UNO","ATmega328P kit"\n` +
      `"Digital Multimeter","Testing & Measurement","${sampleLabCode}",5,"Good","FLU-87","Industrial DMM"`;
    
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
          {row.valid ? '✓ Ready to Generate Asset IDs' : 'Invalid Lab or Model'}
        </span>
      )
    }
  ];

  const totalUnitsToCreate = previewData.reduce((acc, curr) => acc + (curr.valid ? curr.quantity : 0), 0);

  return (
    <div>
      <PageHeader
        title="Bulk Equipment CSV Import"
        subtitle="Upload spreadsheet batches to register equipment. The system automatically creates unique unit Asset IDs & printable QR tags."
      />

      <div className="portal-card">
        <input 
          type="file" 
          accept=".csv" 
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
            {selectedFile ? `Loaded: ${selectedFile}` : 'Click to Select or Drag & Drop Equipment CSV File'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 1rem' }}>
            {selectedFile ? 'Review records and click "Import Records & Generate QR Labels" below' : 'Select a .csv file to import batches of equipment'}
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
              <button 
                className="btn btn-primary" 
                onClick={handleImport}
                disabled={isImporting || totalUnitsToCreate === 0}
              >
                <Sparkles size={16} /> 
                {isImporting ? 'Importing...' : `Import & Generate ${totalUnitsToCreate} Asset QR Codes`}
              </button>
              <button 
                className="btn btn-secondary" 
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
