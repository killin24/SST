import React from 'react';
import { Activity } from 'lucide-react';

const StatusBadge = ({ isOnline }) => {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      borderRadius: '9999px',
      backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
    }}>
      <div className={isOnline ? 'animate-pulse' : ''} style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: isOnline ? 'var(--accent-green)' : 'var(--accent-red)'
      }} />
      <span style={{
        color: isOnline ? 'var(--accent-green)' : 'var(--accent-red)',
        fontSize: '0.875rem',
        fontWeight: '600'
      }}>
        {isOnline ? 'SYSTEM ONLINE' : 'CONNECTION LOST'}
      </span>
      {isOnline && <Activity size={16} color="var(--accent-green)" />}
    </div>
  );
};

export default StatusBadge;