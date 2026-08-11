import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { INITIAL_USERS } from '../../data/mockData';

export const UserManagementPage = () => {
  const columns = [
    { header: 'University ID', accessor: 'universityId' },
    { header: 'Full Name', accessor: 'name' },
    { header: 'Email', accessor: 'email' },
    { header: 'Department', accessor: 'department' },
    { header: 'Role', cell: (row) => <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{row.role}</span> },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> }
  ];

  return (
    <div>
      <PageHeader title="University User Directory" subtitle="Manage portal access accounts, roles, and administrative permissions" />
      <div className="portal-card">
        <DataTable columns={columns} data={INITIAL_USERS} />
      </div>
    </div>
  );
};
