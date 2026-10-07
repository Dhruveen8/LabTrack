import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth, useLabTrack } from '../../context/hooks';
import { resolveUserDepartment } from '../../utils/userDepartment';

export const ProfilePage = () => {
  const { user } = useAuth();
  const { departmentsList } = useLabTrack();

  return (
    <div>
      <PageHeader title="User Account Profile" subtitle="Manage your institutional single sign-on profile and contact preferences" />
      <div className="portal-card" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#1e3a8a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
            {user?.name ? user.name[0] : 'U'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{user?.name}</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Role: <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#1e40af' }}>{user?.role}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
          <div><strong>User ID:</strong> {user?.displayId || user?.universityId}</div>
          <div><strong>Email Address:</strong> {user?.email}</div>
          <div><strong>Department:</strong> {resolveUserDepartment(user, departmentsList)}</div>
          <div><strong>Contact Phone:</strong> {user?.phone || '+1 (555) 012-3390'}</div>
          <div><strong>Account Status:</strong> <span className="badge badge-success">Active & Verified</span></div>
        </div>
      </div>
    </div>
  );
};
