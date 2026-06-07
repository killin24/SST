import React from 'react';

/**
 * StationSelector — animated tab switcher between ISS and Tiangong.
 */
const StationSelector = ({ selected, onChange }) => {
  const stations = [
    {
      id: 'iss',
      label: 'ISS',
      fullName: 'Intl. Space Station',
      flag: '🌍',
      activeClass: 'active-iss',
    },
    {
      id: 'tiangong',
      label: 'Tiangong',
      fullName: 'Chinese Space Station',
      flag: '🇨🇳',
      activeClass: 'active-tiangong',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div className="station-tabs" role="tablist">
        {stations.map((s) => {
          const isActive = selected === s.id;
          return (
            <button
              key={s.id}
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={isActive}
              className={`station-tab ${isActive ? s.activeClass : ''}`}
              onClick={() => onChange(s.id)}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              <span style={{ fontSize: '1.1rem' }}>{s.flag}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
        {stations.find(s => s.id === selected)?.fullName}
      </p>
    </div>
  );
};

export default StationSelector;
