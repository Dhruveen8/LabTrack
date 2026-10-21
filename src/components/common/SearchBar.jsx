import React from 'react';
import { Search, X } from 'lucide-react';

export const SearchBar = ({ value, onChange, placeholder = 'Search equipment, ID, lab...' }) => {
  return (
    <div className="search-control" style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
      <Search
        size={16}
        style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#64748b'
        }}
      />
      <input
        type="text"
        role="searchbox"
        aria-label={placeholder}
        className="form-control"
        style={{ paddingLeft: '32px', paddingRight: value ? '44px' : '12px' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Clear search"
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: '2px',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
