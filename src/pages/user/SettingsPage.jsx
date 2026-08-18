import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Save, Sliders, Shield, Calendar, Bell, CheckCircle2 } from 'lucide-react';

export const SettingsPage = () => {
  const { user } = useAuth();
  const { systemSettings, updateSystemSettingsAction } = useLabTrack();

  const [studentDays, setStudentDays] = useState(systemSettings?.studentBorrowLimitDays || 14);
  const [facultyDays, setFacultyDays] = useState(systemSettings?.facultyBorrowLimitDays || 30);
  const [emailOverdue, setEmailOverdue] = useState(systemSettings?.emailOverdueAlerts ?? true);
  const [transferAlerts, setTransferAlerts] = useState(systemSettings?.transferAlerts ?? true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (systemSettings) {
      setStudentDays(systemSettings.studentBorrowLimitDays || 14);
      setFacultyDays(systemSettings.facultyBorrowLimitDays || 30);
      setEmailOverdue(systemSettings.emailOverdueAlerts ?? true);
      setTransferAlerts(systemSettings.transferAlerts ?? true);
    }
  }, [systemSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    await updateSystemSettingsAction({
      studentBorrowLimitDays: parseInt(studentDays, 10) || 14,
      facultyBorrowLimitDays: parseInt(facultyDays, 10) || 30,
      emailOverdueAlerts: emailOverdue,
      transferAlerts: transferAlerts
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Institutional System Settings & Borrowing Policies"
        subtitle="Configure campus-wide checkout durations, role thresholds, and notification alerts"
      />

      <div style={{ maxWidth: '700px' }}>
        {savedSuccess && (
          <div className="portal-card" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Portal borrowing limits and settings successfully saved!</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Borrowing Policies Card */}
          <div className="portal-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <Calendar size={20} color="#1e40af" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Role-Based Maximum Borrowing Limits
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Define the maximum allowable duration (in calendar days) that students and faculty can checkout equipment per single reservation.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Student Max Borrowing Limit (Days)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="60"
                    value={studentDays}
                    onChange={(e) => setStudentDays(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>days</span>
                </div>
                <small style={{ fontSize: '0.7rem', color: '#64748b' }}>Default: 14 days</small>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Faculty Max Borrowing Limit (Days)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="180"
                    value={facultyDays}
                    onChange={(e) => setFacultyDays(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>days</span>
                </div>
                <small style={{ fontSize: '0.7rem', color: '#64748b' }}>Default: 30 days</small>
              </div>
            </div>
          </div>

          {/* Notifications & Automation Card */}
          <div className="portal-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <Bell size={20} color="#1e40af" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Automated Alerts & Notifications
              </h3>
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={emailOverdue}
                  onChange={(e) => setEmailOverdue(e.target.checked)}
                />
                <span>Send automatic warning notifications when equipment checkout is within 2 days of due date</span>
              </label>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={transferAlerts}
                  onChange={(e) => setTransferAlerts(e.target.checked)}
                />
                <span>Alert Lab Assistants when an inter-laboratory transfer is initialized for their lab</span>
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} /> Save Institutional Policies
          </button>
        </form>
      </div>
    </div>
  );
};
