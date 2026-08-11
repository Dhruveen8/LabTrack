import React from 'react';
import { useLabTrack } from '../../context/LabTrackContext';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotificationPanel = ({ onClose }) => {
  const { notificationsList, markNotificationRead, markAllNotificationsRead } = useLabTrack();

  const getIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={16} color="#b45309" />;
      case 'success': return <CheckCircle size={16} color="#15803d" />;
      default: return <Info size={16} color="#0369a1" />;
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        marginTop: '8px',
        width: '340px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
        zIndex: 1000,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.875rem' }}>
          <Bell size={16} /> Notifications
        </div>
        <button
          onClick={markAllNotificationsRead}
          style={{ background: 'none', border: 'none', color: '#1e40af', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {notificationsList.length > 0 ? (
          notificationsList.map(n => (
            <div
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #f1f5f9',
                backgroundColor: n.read ? '#ffffff' : '#eff6ff',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ marginTop: '2px' }}>{getIcon(n.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>{n.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>{n.message}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>{n.timestamp}</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
            No new notifications
          </div>
        )}
      </div>

      <div
        style={{
          padding: '0.5rem',
          textAlign: 'center',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          fontSize: '0.75rem'
        }}
      >
        <Link to="/notifications" onClick={onClose} style={{ color: '#1e40af', fontWeight: 600 }}>
          View All Notifications
        </Link>
      </div>
    </div>
  );
};
