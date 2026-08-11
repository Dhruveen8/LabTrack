import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumb = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  if (pathnames.length === 0) return null;

  return (
    <nav style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
      <Link to="/" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <Home size={14} />
        <span>Portal Home</span>
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const formattedName = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        return (
          <React.Fragment key={name}>
            <ChevronRight size={14} style={{ margin: '0 0.35rem', color: '#cbd5e1' }} />
            {isLast ? (
              <span style={{ color: '#0f172a', fontWeight: 600 }}>{formattedName}</span>
            ) : (
              <Link to={routeTo} style={{ color: '#64748b' }}>
                {formattedName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
