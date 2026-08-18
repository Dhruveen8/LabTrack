import React from 'react';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, PackagePlus, CalendarCheck, ArrowRightLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotificationPanel = ({ onClose }) => {
  const { user } = useAuth();
  const { notificationsList, markNotificationRead, markAllNotificationsRead } = useLabTrack();

  const role = user?.role || 'student';

  // Filter notifications based on role policy
  const visibleNotifications = notificationsList.filter(n => {
    if (n.targetRoles && n.targetRoles.length > 0 && !n.targetRoles.includes(role)) {
      return false;
    }
    // Admin policy: Admin only receives bulk imports, equipment additions, club/event issues, transfers
    if (role === 'admin') {
      const allowed = ['equipment_addition', 'bulk_import', 'bulk_event_issue', 'inter_lab_transfer', 'system'];
      if (n.category && !allowed.includes(n.category)) return false;
    }
    return true;
  });

  const getIcon = (type, category) => {
    if (category === 'bulk_import' || category === 'equipment_addition') {
      return <PackagePlus size={16} color="#1d4ed8" />;
    }
    if (category === 'bulk_event_issue') {
      return <CalendarCheck size={16} color="#7c3aed" />;
    }
    if (category === 'inter_lab_transfer') {
      return <ArrowRightLeft size={16} color="#0891b2" />;
    }
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
        width: '360px',
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
          <Bell size={16} /> Notifications {role === 'admin' ? '(Executive)' : ''}
        </div>
        <button
          onClick={markAllNotificationsRead}
          style={{ background: 'none', border: 'none', color: '#1e40af', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {visibleNotifications.length > 0 ? (
          visibleNotifications.map(n => (
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
                <div style={{ marginTop: '2px' }}>{getIcon(n.type, n.category)}</div>
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
