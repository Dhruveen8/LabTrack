import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Save } from 'lucide-react';

export const SettingsPage = () => {
  return (
    <div>
      <PageHeader title="University Portal System Settings" subtitle="Configure system parameters, alert thresholds, and operational preferences" />
      <div className="portal-card" style={{ maxWidth: '600px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Notification Preferences</h3>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" defaultChecked /> Email notification on overdue items
          </label>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" defaultChecked /> Inter-lab transfer status alerts
          </label>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 1rem' }}>Borrowing Limits & Rules</h3>
        <div className="form-group">
          <label className="form-label">Default Borrowing Duration (Days)</label>
          <input type="number" className="form-control" defaultValue={14} />
        </div>

        <button className="btn btn-primary" onClick={() => alert('Settings saved')}>
          <Save size={16} /> Save Portal Settings
        </button>
      </div>
    </div>
  );
};
