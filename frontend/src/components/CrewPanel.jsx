import React from 'react';
import { Users } from 'lucide-react';

/**
 * CrewPanel — displays current crew members aboard the selected station.
 */
const CrewPanel = ({ crew = [], station }) => {
  const isISS      = station === 'iss';
  const accentColor = isISS ? 'var(--accent-cyan)' : 'var(--accent-tiangong)';
  const stationName = isISS ? 'ISS' : 'Tiangong';

  // Nationality heuristics for flag emoji
  const getFlagEmoji = (name) => {
    const lower = name.toLowerCase();
    // Chinese names (Tiangong crew)
    if (/li |ye |wang |chen |zhang |tang |zhai |liu |jiang/.test(lower)) return '🇨🇳';
    // Russian names
    if (/enko|ov |nov |ev |sky|kin |kin$|ova$|ova |ev$/.test(lower)) return '🇷🇺';
    // Japanese names  
    if (/wakata|furukawa|hoshide|onishi|kanai/.test(lower)) return '🇯🇵';
    // European names (ESA)
    if (/pesquet|maurer|cristoforetti|mogensen|nespoli/.test(lower)) return '🇪🇺';
    // Default: USA 🇺🇸
    return '🇺🇸';
  };

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: `rgba(${isISS ? '0,212,255' : '249,115,22'}, 0.12)`,
            padding: '0.6rem',
            borderRadius: '0.6rem',
            display: 'flex',
            color: accentColor,
          }}>
            <Users size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Current Crew
            </p>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Aboard {stationName}
            </h3>
          </div>
        </div>

        {/* Crew count badge */}
        <div style={{
          background: `rgba(${isISS ? '0,212,255' : '249,115,22'}, 0.15)`,
          border: `1px solid rgba(${isISS ? '0,212,255' : '249,115,22'}, 0.3)`,
          borderRadius: '9999px',
          padding: '0.25rem 0.9rem',
          fontSize: '1.1rem',
          fontWeight: 700,
          color: accentColor,
        }}>
          {crew.length} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)' }}>aboard</span>
        </div>
      </div>

      {/* Crew List */}
      {crew.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
          Loading crew manifest...
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {crew.map((name, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.9rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '0.6rem',
                border: '1px solid rgba(255,255,255,0.05)',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <span style={{ fontSize: '1.2rem' }}>{getFlagEmoji(name)}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {name}
              </span>
              <div style={{
                marginLeft: 'auto',
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: accentColor,
                boxShadow: `0 0 6px ${accentColor}`,
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CrewPanel;
