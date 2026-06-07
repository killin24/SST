import React from 'react';

/**
 * InfoCard — generic card for supplementary telemetry fields.
 * Supports: number values, text/badge values, and special "visibility" mode.
 *
 * @param {string}  title      - Label shown above the value
 * @param {*}       value      - The raw value (string or number)
 * @param {string}  unit       - Optional unit suffix
 * @param {node}    icon       - Lucide icon component
 * @param {string}  color      - CSS variable suffix (e.g. 'cyan', 'amber')
 * @param {string}  badge      - If set, renders a colored pill instead of number
 * @param {string}  badgeColor - Hex color for the badge
 * @param {number}  decimals   - How many decimal places for number values (default 2)
 */
const InfoCard = ({
  title,
  value,
  unit = '',
  icon: Icon,
  color = 'cyan',
  badge = null,
  badgeColor = null,
  decimals = 2,
}) => {
  const accentVar = `var(--accent-${color})`;

  const formatValue = (v) => {
    if (v == null) return '--';
    if (typeof v === 'number') {
      return v.toLocaleString(undefined, { maximumFractionDigits: decimals });
    }
    return String(v);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = `0 12px 32px -4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {Icon && (
          <div style={{
            background: `rgba(${colorToRgb(color)}, 0.12)`,
            padding: '0.5rem',
            borderRadius: '0.5rem',
            color: accentVar,
            display: 'flex',
            lineHeight: 0,
          }}>
            <Icon size={16} />
          </div>
        )}
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
      </div>

      {/* Value area */}
      {badge ? (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: `${badgeColor || accentVar}1e`,
          border: `1px solid ${badgeColor || accentVar}44`,
          borderRadius: '9999px',
          padding: '0.35rem 0.85rem',
          alignSelf: 'flex-start',
        }}>
          <div style={{
            width: '7px', height: '7px',
            borderRadius: '50%',
            background: badgeColor || accentVar,
            boxShadow: `0 0 6px ${badgeColor || accentVar}`,
          }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: badgeColor || accentVar }}>
            {value ?? '--'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <span style={{
            fontSize: '1.6rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {formatValue(value)}
          </span>
          {unit && (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Map color name to approximate RGB for background opacity tricks
const colorToRgb = (color) => {
  const map = {
    cyan:     '0,212,255',
    purple:   '168,85,247',
    green:    '16,185,129',
    red:      '239,68,68',
    amber:    '245,158,11',
    tiangong: '249,115,22',
  };
  return map[color] || '0,212,255';
};

export default InfoCard;
