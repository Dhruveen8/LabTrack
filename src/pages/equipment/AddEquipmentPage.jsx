import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { QRCodeDisplay } from '../../components/scanner/QRCodeDisplay';
import { QRPrintSheet } from '../../components/scanner/QRPrintSheet';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QrCode, Save, X, Printer, CheckCircle2 } from 'lucide-react';

export const AddEquipmentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { labsList, addEquipment } = useLabTrack();

  const assignedLabIds = user?.assignedLabIds || [];
  const availableLabs = (user?.role === 'assistant' && assignedLabIds.length > 0)
    ? labsList.filter(l => assignedLabIds.includes(l.id))
    : labsList;

  const defaultLab = availableLabs[0] || labsList[0] || { id: 'LAB-IOT', name: 'IoT & Embedded Systems Lab' };

  const [formData, setFormData] = useState({
    name: '',
    category: 'Microcontrollers',
    labId: defaultLab.id,
    labName: defaultLab.name,
    quantity: 5,
    purchaseDate: new Date().toISOString().split('T')[0],
    condition: 'Excellent',
    status: 'Available',
    serialNumber: '',
    description: ''
  });

  const [createdItem, setCreatedItem] = useState(null);
  const [showPrintSheet, setShowPrintSheet] = useState(false);

  const handleLabChange = (e) => {
    const labId = e.target.value;
    const targetLab = labsList.find(l => l.id === labId);
    setFormData(prev => ({
      ...prev,
      labId,
      labName: targetLab ? targetLab.name : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Please enter equipment name');

    const created = await addEquipment(formData);
    setCreatedItem(created);
    setShowPrintSheet(true);
  };

  return (
    <div>
      <PageHeader
        title="Add New Laboratory Equipment"
        subtitle="Register new hardware assets into campus inventory. Unique unit Asset IDs & QR tags will be generated automatically."
      />

      <div className="portal-card" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Equipment Model / Name</label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Rigol DS1054Z Digital Oscilloscope"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Quantity of Units</label>
              <input
                type="number"
                className="form-control"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                min="1"
                required
              />
              <small style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Generates {formData.quantity || 1} individual Asset QR codes
              </small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Microcontrollers">Microcontrollers (MC)</option>
                <option value="Single Board Computers">Single Board Computers (SBC)</option>
                <option value="Testing & Measurement">Testing & Measurement (TM)</option>
                <option value="Workshop Tools">Workshop Tools (WT)</option>
                <option value="Rapid Prototyping">Rapid Prototyping (RP)</option>
                <option value="Robotics">Robotics (ROB)</option>
                <option value="AR / VR">AR / VR (VR)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Laboratory</label>
              <select
                className="form-select"
                value={formData.labId}
                onChange={handleLabChange}
              >
                {availableLabs.map(lab => (
                  <option key={lab.id} value={lab.id}>{lab.name} ({lab.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Manufacturer Serial No. Prefix (Optional)</label>
              <input
                type="text"
                className="form-control"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="e.g. SN-DS1054Z"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Initial Physical Condition</label>
              <select
                className="form-select"
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              >
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Calibration Required">Calibration Required</option>
                <option value="Under Maintenance">Under Maintenance</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description / Specifications</label>
            <textarea
              className="form-control"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Hardware specifications, included probes, voltage ratings..."
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Save size={16} /> Register Equipment & Generate QR Labels
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/equipment')}>
              <X size={16} /> Cancel
            </button>
          </div>
        </form>
      </div>

      {/* QR Print Sheet Modal popup after creation */}
      {showPrintSheet && createdItem && createdItem.units && (
        <QRPrintSheet
          items={createdItem.units}
          title={`QR Labels for ${createdItem.name} (${createdItem.units.length} Units)`}
          onClose={() => {
            setShowPrintSheet(false);
            navigate('/equipment');
          }}
        />
      )}
    </div>
  );
};
