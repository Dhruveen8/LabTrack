import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useLabTrack, useAuth, useCart, useToast } from '../../context/hooks';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SearchBar } from '../../components/common/SearchBar';
import { Link } from 'react-router-dom';
import { Send, Eye } from 'lucide-react';

export const BrowseEquipmentPage = () => {
  const { user } = useAuth();
  const { add, busy } = useCart();
  const { addToast } = useToast();
  const addToCart = async (item) => {
    try {
      const result = await add(item.id, item.labId);
      const current = result.items.find(row => row.model_id === item.id && row.lab_id === item.labId);
      addToast(current?.insufficient ? 'Kept in cart, but stock is insufficient. Revise before submitting.' : 'Added to cart. Stock is not reserved yet.', current?.insufficient ? 'warning' : 'success');
    } catch (error) { addToast(error.response?.data?.detail?.message || error.message, 'error'); }
  };
  const { equipmentList } = useLabTrack();
  const [search, setSearch] = useState('');
  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredEquipment = equipmentList.filter(item => {
    const searchable = [item.name, item.id, item.category, item.labName].filter(value => value != null).join(' ').toLowerCase();
    return searchTerms.every(term => searchable.includes(term));
  });

  return (
    <div>
      <PageHeader title="Browse University Equipment Catalog" subtitle="Search hardware, microcontrollers, and measurement instruments available across all labs" />
      <div role="search" aria-label="Equipment catalog" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '.75rem', marginBottom: '1.25rem' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, category, lab or ID…" />
        <p role="status" style={{ fontSize: '.8rem', color: 'var(--color-text-muted)' }}>{filteredEquipment.length} of {equipmentList.length} equipment models</p>
      </div>
      {!filteredEquipment.length && <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '.4rem' }}>{searchTerms.length ? 'No equipment matches your search' : 'No equipment available'}</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>{searchTerms.length ? 'Try another name, category, lab or equipment ID.' : 'Equipment will appear here when it is added to a lab.'}</p>
      </div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {filteredEquipment.map(item => (
          <div key={item.id} className="portal-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                  {item.id}
                </span>
                <StatusBadge status={item.status} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{item.name}</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>{item.labName}</p>
              <div style={{ fontSize: '0.8rem', color: '#334155', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                <span>Available: <strong>{item.availableQuantity}</strong> / {item.quantity}</span>
                <span>Category: <strong>{item.category}</strong></span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Link to={`/equipment/${item.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                <Eye size={14} /> Details
              </Link>
              {user?.role === 'student' ? <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={busy} onClick={() => addToCart(item)}><Send size={14} /> Add to cart</button> : <Link to={`/request-equipment?id=${item.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                <Send size={14} /> Request
              </Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
