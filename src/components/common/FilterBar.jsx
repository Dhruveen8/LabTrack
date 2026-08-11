import React from 'react';
import { Filter } from 'lucide-react';

export const FilterBar = ({ filters, options, onChange }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.85rem' }}>
        <Filter size={15} />
        <span style={{ fontWeight: 600 }}>Filter:</span>
      </div>
      {options.map((opt) => (
        <select
          key={opt.key}
          className="form-select"
          style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
          value={filters[opt.key] || ''}
          onChange={(e) => onChange(opt.key, e.target.value)}
        >
          <option value="">{opt.label}: All</option>
          {opt.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
};
