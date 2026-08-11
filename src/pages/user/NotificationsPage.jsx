import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle } from 'lucide-react';

export const NotificationsPage = () => {
  const { notificationsList, markAllNotificationsRead } = useLabTrack();

  return (
    <div>
      <PageHeader
        title="Notification Center"
        subtitle="Important portal alerts, equipment return reminders, and request status updates"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={markAllNotificationsRead}>
            <CheckCheck size={14} /> Mark All as Read
          </button>
        }
      />
      <div className="portal-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notificationsList.map(n => (
            <div
              key={n.id}
              style={{
                padding: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                backgroundColor: n.read ? '#ffffff' : '#eff6ff'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>{n.title}</div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>{n.message}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>{n.timestamp}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
