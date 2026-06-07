import React from 'react';

const TelemetryCard = ({ title, value, unit, icon: Icon, color = 'cyan' }) => {
  const accentVar = `var(--accent-${color})`;

  const formatValue = (v) => {
    if (v == null) return '--';
    if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(v);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = `0 12px 32px -4px rgba(0,0,0,0.6)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div style={{
        background: accentVar,
        padding: '0.9rem',
        borderRadius: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000',
        flexShrink: 0,
        boxShadow: `0 0 16px ${accentVar}55`,
      }}>
        {Icon && <Icon size={26} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--text-secondary)',
          fontWeight: 600,
        }}>
          {title}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.35rem' }}>
          <h3 style={{
            margin: 0,
            fontSize: '1.9rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {formatValue(value)}
          </h3>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TelemetryCard;