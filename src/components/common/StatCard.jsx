import React from 'react';

export const StatCard = ({ title, value, icon: Icon, color = 'blue', subtext, trend }) => {
  const getColorStyles = () => {
    switch (color) {
      case 'green':
        return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', iconBg: '#dcfce7' };
      case 'amber':
      case 'warning':
        return { bg: '#fffbeb', border: '#fef08a', text: '#b45309', iconBg: '#fef3c7' };
      case 'red':
      case 'danger':
        return { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', iconBg: '#fee2e2' };
      case 'purple':
        return { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', iconBg: '#f3e8ff' };
      case 'blue':
      default:
        return { bg: '#ffffff', border: '#e2e8f0', text: '#1e40af', iconBg: '#eff6ff' };
    }
  };

  const style = getColorStyles();

  return (
    <div
      className="portal-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: `4px solid ${style.text}`,
        marginBottom: 0
      }}
    >
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0.25rem 0' }}>
          {value}
        </div>
        {subtext && (
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {subtext}
          </div>
        )}
      </div>
      {Icon && (
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            backgroundColor: style.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: style.text
          }}
        >
          <Icon size={22} />
        </div>
      )}
    </div>
  );
};
