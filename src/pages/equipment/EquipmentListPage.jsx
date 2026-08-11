import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useLabTrack } from '../../context/LabTrackContext';
import { Link } from 'react-router-dom';
import { Plus, Upload, Eye, Edit, Trash2 } from 'lucide-react';

export const EquipmentListPage = () => {
  const { equipmentList, deleteEquipment } = useLabTrack();

  const columns = [
    { header: 'Equipment ID', accessor: 'id' },
    { header: 'Equipment Name', accessor: 'name' },
    { header: 'Category', accessor: 'category' },
    { header: 'Lab Name', accessor: 'labName' },
    { header: 'Total Quantity', accessor: 'quantity' },
    { header: 'Available', accessor: 'availableQuantity' },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <Link to={`/equipment/${row.id}`} className="btn btn-secondary btn-sm" title="View">
            <Eye size={14} />
          </Link>
          <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => alert(`Edit ${row.id}`)}>
            <Edit size={14} />
          </button>
          <button className="btn btn-danger btn-sm" title="Delete" onClick={() => deleteEquipment(row.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="University Equipment Management"
        subtitle="Comprehensive laboratory equipment directory, stock availability, and status tracking"
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/equipment/add" className="btn btn-primary">
              <Plus size={14} /> Add Equipment
            </Link>
            <Link to="/bulk-import" className="btn btn-secondary">
              <Upload size={14} /> Import CSV/Excel
            </Link>
          </div>
        }
      />
      <div className="portal-card">
        <DataTable columns={columns} data={equipmentList} />
      </div>
    </div>
  );
};
