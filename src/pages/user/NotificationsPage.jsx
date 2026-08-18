import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack } from '../../context/LabTrackContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle, PackagePlus, CalendarCheck, ArrowRightLeft } from 'lucide-react';

export const NotificationsPage = () => {
  const { user } = useAuth();
  const { notificationsList, markAllNotificationsRead } = useLabTrack();
  const [filterType, setFilterType] = useState('ALL');

  const role = user?.role || 'student';

  // Filter by role policy
  let visibleNotifications = notificationsList.filter(n => {
    if (n.targetRoles && n.targetRoles.length > 0 && !n.targetRoles.includes(role)) {
      return false;
    }
    // Admin receives high-level events only (no single-item issues/returns)
    if (role === 'admin') {
      const allowed = ['equipment_addition', 'bulk_import', 'bulk_event_issue', 'inter_lab_transfer', 'system'];
      if (n.category && !allowed.includes(n.category)) return false;
    }
    return true;
  });

  if (filterType === 'UNREAD') {
    visibleNotifications = visibleNotifications.filter(n => !n.read);
  }

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'bulk_import':
        return <span className="badge badge-success">Bulk Import</span>;
      case 'equipment_addition':
        return <span className="badge badge-info">Equipment Added</span>;
      case 'bulk_event_issue':
        return <span className="badge badge-purple">Club / Event Batch</span>;
      case 'inter_lab_transfer':
        return <span className="badge badge-secondary">Inter-Lab Transfer</span>;
      default:
        return null;
    }
  };

  return (
    <div>
      <PageHeader
        title="Notification Center"
        subtitle={
          role === 'admin'
            ? "Executive alerts for new equipment additions, bulk imports, club/event batch issues, and transfers"
            : "Important portal alerts, equipment return reminders, and request status updates"
        }
        actions={
          <button className="btn btn-secondary btn-sm" onClick={markAllNotificationsRead}>
            <CheckCheck size={14} /> Mark All as Read
          </button>
        }
      />

      {role === 'admin' && (
        <div className="portal-card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>
            <strong>Admin Notification Policy:</strong> Minor single-item counter issues and returns are handled by Lab Assistants and omitted from your feed. You receive notifications for new equipment registrations, bulk imports, club/event bulk allocations, and inter-lab transfers.
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setFilterType('ALL')}
          className={`btn btn-sm ${filterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Notifications ({visibleNotifications.length})
        </button>
        <button
          onClick={() => setFilterType('UNREAD')}
          className={`btn btn-sm ${filterType === 'UNREAD' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Unread Only
        </button>
      </div>

      <div className="portal-card">
        {visibleNotifications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {visibleNotifications.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: n.read ? '#ffffff' : '#eff6ff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{n.title}</span>
                    {getCategoryBadge(n.category)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>{n.message}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>{n.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            No notifications found.
          </div>
        )}
      </div>
    </div>
  );
};
