import React from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import TelemetryCard from '../components/TelemetryCard';
import TelemetryChart from '../components/TelemetryChart';
import StatusBadge from '../components/StatusBadge';
import { Compass, Gauge, ArrowUpCircle, RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * Formats coordinates into standard aerospace notation (e.g., 28.56° N, 163.91° W)
 */
const formatCoordinates = (lat, lon) => {
  if (lat == null || lon == null) return null;
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (isNaN(latNum) || isNaN(lonNum)) return null;

  const latDir = latNum >= 0 ? 'N' : 'S';
  const lonDir = lonNum >= 0 ? 'E' : 'W';

  return `${Math.abs(latNum).toFixed(2)}° ${latDir}, ${Math.abs(lonNum).toFixed(2)}° ${lonDir}`;
};

/**
 * Main Dashboard Page
 * The Senior Way: Error boundaries, loading states, and robust retry mechanisms.
 */
const Dashboard = () => {
  const { data, loading, error, history, retry } = useTelemetry(3000);

  // Loading State
  if (loading && !data) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div className="animate-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Acquiring orbital link...</p>
      </div>
    );
  }

  // Error Boundary State
  if (error && !data) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertTriangle size={48} color="var(--accent-red)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Telemetry Link Failed</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
          <button 
            onClick={retry}
            style={{
              background: 'var(--accent-cyan)',
              color: '#000',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '9999px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.target.style.opacity = 0.8}
            onMouseOut={(e) => e.target.style.opacity = 1}
          >
            <RefreshCw size={18} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      
      {/* Header Section */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>ISS Telemetry Tracker</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>Live Orbital Data Feed</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {error && <span style={{ color: 'var(--accent-red)', fontSize: '0.875rem' }}>Connection struggling...</span>}
          <StatusBadge isOnline={!error} />
        </div>
      </header>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <TelemetryCard 
          title="Orbital Velocity" 
          value={data?.velocity} 
          unit="km/h" 
          icon={Gauge} 
          color="cyan" 
        />
        <TelemetryCard 
          title="Altitude" 
          value={data?.altitude} 
          unit="km" 
          icon={ArrowUpCircle} 
          color="purple" 
        />
        <TelemetryCard 
          title="Coordinates" 
          value={formatCoordinates(data?.latitude, data?.longitude)} 
          unit="" 
          icon={Compass} 
          color="green" 
        />
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        <TelemetryChart 
          data={history} 
          dataKey="latitude" 
          color="var(--accent-cyan)" 
          name="Latitude" 
          unit="°" 
        />
        <TelemetryChart 
          data={history} 
          dataKey="longitude" 
          color="var(--accent-purple)" 
          name="Longitude" 
          unit="°" 
        />
      </div>

    </div>
  );
};

export default Dashboard;