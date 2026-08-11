import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { QRCodeDisplay } from '../../components/scanner/QRCodeDisplay';
import { useLabTrack } from '../../context/LabTrackContext';
import { useNavigate } from 'react-router-dom';
import { QrCode, Save, X } from 'lucide-react';

export const AddEquipmentPage = () => {
  const navigate = useNavigate();
  const { addEquipment } = useLabTrack();

  const [formData, setFormData] = useState({
    id: `EQ-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    category: 'Microcontrollers',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    quantity: 5,
    purchaseDate: new Date().toISOString().split('T')[0],
    condition: 'Excellent',
    status: 'Available',
    description: ''
  });

  const [generatedQR, setGeneratedQR] = useState(null);

  const handleGenerateQR = () => {
    setGeneratedQR(formData.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert('Please enter equipment name');
    await addEquipment(formData);
    navigate('/equipment');
  };

  return (
    <div>
      <PageHeader title="Add New Laboratory Equipment" subtitle="Register new hardware asset into campus inventory" />
      <div className="portal-card" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Equipment Name</label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Raspberry Pi 4 (8GB)"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Equipment ID (Auto / Manual)</label>
              <input
                type="text"
                className="form-control"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                <option value="Microcontrollers">Microcontrollers</option>
                <option value="Single Board Computers">Single Board Computers</option>
                <option value="Testing & Measurement">Testing & Measurement</option>
                <option value="Workshop Tools">Workshop Tools</option>
                <option value="Rapid Prototyping">Rapid Prototyping</option>
                <option value="Robotics">Robotics</option>
                <option value="AR / VR">AR / VR</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Laboratory</label>
              <select className="form-select" value={formData.labId} onChange={(e) => setFormData({ ...formData, labId: e.target.value })}>
                <option value="LAB-IOT">IoT & Embedded Systems Lab</option>
                <option value="LAB-ECE">Electronics & VLSI Lab</option>
                <option value="LAB-ROB">Robotics & Automation Lab</option>
                <option value="LAB-CS">Computer & AI Research Lab</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                type="number"
                className="form-control"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                min="1"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input type="date" className="form-control" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select className="form-select" value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })}>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Calibration Required">Calibration Required</option>
                <option value="Under Maintenance">Under Maintenance</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Initial Status</label>
              <select className="form-select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
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
              placeholder="Hardware specs, model details..."
            />
          </div>

          {generatedQR && (
            <div style={{ margin: '1rem 0', textAlign: 'center' }}>
              <QRCodeDisplay value={generatedQR} title="Generated Asset QR Code Tag" />
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleGenerateQR}>
              <QrCode size={16} /> Generate QR Code
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Save Equipment
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/equipment')}>
              <X size={16} /> Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
