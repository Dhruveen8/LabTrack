import React from 'react';

export const StatusBadge = ({ status }) => {
  const getVariant = () => {
    switch (status?.toLowerCase()) {
      case 'available':
      case 'approved':
      case 'returned':
      case 'active':
      case 'completed':
        return 'badge-success';
      case 'pending':
      case 'calibration required':
      case 'due soon':
      case 'transferred':
        return 'badge-warning';
      case 'unavailable':
      case 'overdue':
      case 'rejected':
      case 'deactivated':
      case 'under maintenance':
        return 'badge-danger';
      case 'issued':
      case 'borrowed':
      case 'in progress':
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  };

  return (
    <span className={`badge ${getVariant()}`}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
      {status || 'Unknown'}
    </span>
  );
};
