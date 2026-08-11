import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export const EventIssuePage = () => {
  const navigate = useNavigate();
  const { useToast } = useLabTrack();

  const [eventName, setEventName] = useState('RoboWars 2024 University Workshop');
  const [coordinator, setCoordinator] = useState('Prof. Eleanor Vance');
  const [purpose, setPurpose] = useState('Inter-department robotics competition hardware setup');
  const [issueDate, setIssueDate] = useState('2026-08-15');
  const [returnDate, setReturnDate] = useState('2026-08-20');

  const [items, setItems] = useState([
    { name: 'Arduino Uno R3 Kit', qty: 5 },
    { name: 'ESP32 NodeMCU', qty: 4 },
    { name: 'Sensor Module Pack', qty: 10 },
    { name: 'Digital Oscilloscope', qty: 1 }
  ]);

  const totalQty = items.reduce((acc, i) => acc + (parseInt(i.qty, 10) || 0), 0);

  const handleAddItem = () => {
    setItems([...items, { name: 'Raspberry Pi 4', qty: 2 }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    alert(`Event equipment issue recorded for "${eventName}" (${totalQty} total items).`);
    navigate('/transactions');
  };

  return (
    <div>
      <PageHeader title="Multiple Equipment / Event Issue Portal" subtitle="Issue bulk laboratory hardware for workshops, club hackathons, or university events" />
      <div className="portal-card" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Club / Event Name</label>
            <input type="text" className="form-control" value={eventName} onChange={(e) => setEventName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Faculty Coordinator</label>
            <input type="text" className="form-control" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Event Purpose / Objectives</label>
          <input type="text" className="form-control" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Issue Date</label>
            <input type="date" className="form-control" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Expected Return Date</label>
            <input type="date" className="form-control" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Requested Hardware Equipment List</h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
              <Plus size={14} /> Add Item Row
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  value={item.name}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].name = e.target.value;
                    setItems(newItems);
                  }}
                  style={{ flex: 3 }}
                />
                <input
                  type="number"
                  className="form-control"
                  value={item.qty}
                  min="1"
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].qty = parseInt(e.target.value, 10) || 1;
                    setItems(newItems);
                  }}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveItem(index)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e40af', textAlign: 'right' }}>
            Total Items Allocated: {totalQty} Units
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-primary" onClick={handleConfirm}>
            <CheckCircle2 size={16} /> Confirm Event Equipment Issue
          </button>
        </div>
      </div>
    </div>
  );
};
