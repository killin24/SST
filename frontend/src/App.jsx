import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useStationData } from './hooks/useStationData';
import TelemetryCard from './components/TelemetryCard';
import TelemetryChart from './components/TelemetryChart';
import StatusBadge from './components/StatusBadge';
import StationSelector from './components/StationSelector';
import StationMap from './components/StationMap';
import CrewPanel from './components/CrewPanel';
import InfoCard from './components/InfoCard';
import PayButton from './components/PayButton';
import {
  Compass, Gauge, ArrowUpCircle, AlertTriangle, RefreshCw,
  Radio, Footprints, Sun, Calendar, Clock, Orbit,
} from 'lucide-react';
import './index.css';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const formatCoordinates = (lat, lon) => {
  if (lat == null || lon == null) return null;
  const la = Number(lat), lo = Number(lon);
  if (isNaN(la) || isNaN(lo)) return null;
  return `${Math.abs(la).toFixed(2)}° ${la >= 0 ? 'N' : 'S'}, ${Math.abs(lo).toFixed(2)}° ${lo >= 0 ? 'E' : 'W'}`;
};

const formatJulian = (daynum) => {
  if (!daynum) return null;
  return Number(daynum).toFixed(4);
};

// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────
function App() {
  const [selectedStation, setSelectedStation] = useState('iss');
  const [isConnected, setIsConnected]         = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [socket, setSocket]                   = useState(null);

  const socketRef = useRef(null);

  // Initialise socket connection once
  useEffect(() => {
    const url = import.meta.env.MODE === 'production' ? '/' : 'http://localhost:5000';
    const sock = io(url, { reconnection: true, reconnectionDelay: 1000 });
    socketRef.current = sock;
    setSocket(sock); // triggers useStationData re-subscription

    sock.on('connect',       () => { setIsConnected(true); setConnectionError(null); setLoading(false); });
    sock.on('disconnect',    () => { setIsConnected(false); });
    sock.on('connect_error', (err) => {
      setConnectionError(`Telemetry link struggling — reconnecting… (${err.message})`);
      setIsConnected(false);
      setLoading(false);
    });

    return () => sock.disconnect();
  }, []);

  // Station data hook (listens to the shared socket)
  const {
    issData, issHistory,
    tiangongData, tiangongHistory,
    crew,
  } = useStationData(socket);

  // Derive active data based on selected station
  const data    = selectedStation === 'iss' ? issData    : tiangongData;
  const history = selectedStation === 'iss' ? issHistory : tiangongHistory;
  const crewList = selectedStation === 'iss' ? crew.iss  : crew.tiangong;

  const primaryColor   = selectedStation === 'iss' ? 'cyan'  : 'tiangong';
  const secondaryColor = selectedStation === 'iss' ? 'purple': 'amber';
  const accentHex      = selectedStation === 'iss' ? '#00d4ff' : '#f97316';

  const stationName = selectedStation === 'iss' ? 'ISS' : 'Tiangong';
  const stationFull = selectedStation === 'iss'
    ? 'International Space Station'
    : 'Tiangong Space Station';

  // ── Visibility badge config ──────────────────────────────
  const visibilityBadgeColor = data?.visibility === 'daylight' ? '#10b981' : '#8b5cf6';
  const visibilityLabel = data?.visibility === 'daylight' ? '🌅 Daylight' : '🌙 Eclipsed';

  // ── Loading Screen ───────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '1.5rem',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ position: 'relative', width: '60px', height: '60px' }}>
          <div className="animate-pulse" style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'radial-gradient(circle, #00d4ff 0%, #0284c7 100%)',
            boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)',
          }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>
            Establishing Orbital Link
          </p>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Connecting to telemetry feed…
          </p>
        </div>
      </div>
    );
  }

  // ── Per-station data pending (socket connected, but this station hasn't sent data yet) ──
  const StationPendingScreen = () => {
    const isISS   = selectedStation === 'iss';
    const color   = isISS ? '#00d4ff' : '#f97316';
    const shadow  = isISS ? 'rgba(0,212,255,0.5)' : 'rgba(249,115,22,0.5)';
    const label   = isISS ? 'ISS' : 'Tiangong';
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '1.5rem', minHeight: '60vh',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ position: 'relative', width: '64px', height: '64px' }}>
          <div className="animate-pulse" style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: `radial-gradient(circle, ${color} 0%, ${color}88 100%)`,
            boxShadow: `0 0 30px ${shadow}`,
          }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
            Acquiring {label} Telemetry
          </p>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Fetching orbital data from CelesTrak…
          </p>
        </div>
      </div>
    );
  };


  // ── Hard Connection Error (no data yet) ─────────────────
  if (connectionError && !data) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center',
        justifyContent: 'center', position: 'relative', zIndex: 1,
      }}>
        <div className="glass-panel" style={{
          padding: '3rem', textAlign: 'center', maxWidth: '480px',
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertTriangle size={48} color="var(--accent-red)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            Telemetry Link Failed
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
            {connectionError}
          </p>
          <button
            id="reconnect-btn"
            onClick={() => { setLoading(true); socketRef.current?.connect(); }}
            style={{
              background: 'var(--accent-cyan)', color: '#000', border: 'none',
              padding: '0.75rem 2rem', borderRadius: '9999px',
              fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <RefreshCw size={18} /> Reconnect
          </button>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ───────────────────────────────────────
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* ── Header ───────────────────────────────────────── */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem',
        }}>
          <div>
            <h1
              className={selectedStation === 'iss' ? 'text-gradient' : 'text-gradient-tiangong'}
              style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, lineHeight: 1 }}
            >
              {stationFull}
            </h1>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Real-Time Orbital Telemetry • WebSocket Stream
              {data?.timestamp && (
                <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                  Last update: {new Date(data.timestamp).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {connectionError && (
              <span style={{ color: 'var(--accent-amber)', fontSize: '0.8rem' }}>
                ⚠ {connectionError}
              </span>
            )}
            <StatusBadge isOnline={isConnected} />
          </div>
        </header>

        {/* ── Station Selector & Actions ─────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <StationSelector selected={selectedStation} onChange={setSelectedStation} />
          
          <button
            onClick={() => {
              const url = import.meta.env.MODE === 'production' 
                ? `/api/history/${selectedStation}/download`
                : `http://localhost:5000/api/history/${selectedStation}/download`;
              window.open(url, '_blank');
            }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--panel-border)',
              color: 'var(--text-secondary)',
              padding: '0.6rem 1.2rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            title="Download CSV of the last 7 days of telemetry"
          >
            📥 Download 7-Day Data
          </button>

          {/* Razorpay payment button */}
          <PayButton
            amount={99}
            label="Support Project"
            accentColor={accentColor}
          />
        </div>

        {!data ? (
          <StationPendingScreen />
        ) : (
          <>
            {/* ── Primary Metrics ──────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}>
          <TelemetryCard
            title="Orbital Velocity"
            value={data?.velocity}
            unit="km/h"
            icon={Gauge}
            color={primaryColor}
          />
          <TelemetryCard
            title="Altitude"
            value={data?.altitude}
            unit="km"
            icon={ArrowUpCircle}
            color={secondaryColor}
          />
          <TelemetryCard
            title="Coordinates"
            value={formatCoordinates(data?.latitude, data?.longitude)}
            unit=""
            icon={Compass}
            color="green"
          />
        </div>

        {/* ── Secondary Metrics ────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          {/* Visibility badge */}
          <InfoCard
            title="Visibility"
            value={visibilityLabel}
            icon={Radio}
            color={data?.visibility === 'daylight' ? 'green' : 'purple'}
            badge={true}
            badgeColor={visibilityBadgeColor}
          />
          <InfoCard
            title="Signal Footprint"
            value={data?.footprint}
            unit="km"
            icon={Footprints}
            color="amber"
            decimals={0}
          />
          <InfoCard
            title="Solar Latitude"
            value={data?.solar_lat}
            unit="°"
            icon={Sun}
            color={primaryColor}
            decimals={2}
          />
          <InfoCard
            title="Solar Longitude"
            value={data?.solar_lon}
            unit="°"
            icon={Sun}
            color={secondaryColor}
            decimals={2}
          />
          <InfoCard
            title="Julian Day"
            value={formatJulian(data?.daynum)}
            unit=""
            icon={Calendar}
            color="amber"
            decimals={4}
          />
          <InfoCard
            title="Orbital Period"
            value={data?.period}
            unit="min"
            icon={Orbit}
            color="green"
            decimals={2}
          />
        </div>

        {/* ── Live Map ─────────────────────────────────────── */}
        <div style={{ marginBottom: '2rem' }}>
          <StationMap data={data} station={selectedStation} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}>
          <CrewPanel crew={crewList} station={selectedStation} />

          {/* Velocity + Altitude charts stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TelemetryChart
              data={history}
              dataKey="velocity"
              color={accentHex}
              name="Velocity"
              unit=" km/h"
            />
          </div>
        </div>

        {/* ── Lat/Lon Charts ───────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '1.5rem',
        }}>
          <TelemetryChart
            data={history}
            dataKey="latitude"
            color={accentHex}
            name="Latitude"
            unit="°"
          />
          <TelemetryChart
            data={history}
            dataKey="longitude"
            color={selectedStation === 'iss' ? 'var(--accent-purple)' : 'var(--accent-amber)'}
            name="Longitude"
            unit="°"
          />
        </div>

        {/* ── Altitude Chart ───────────────────────────────── */}
        <div style={{ marginTop: '1.5rem' }}>
          <TelemetryChart
            data={history}
            dataKey="altitude"
            color="var(--accent-green)"
            name="Altitude"
            unit=" km"
          />
        </div>
          </>
        )}

      </div>
    </div>
  );
}

export default App;
