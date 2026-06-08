import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

// Dynamically import Leaflet to avoid module resolution issues
let L = null;

/**
 * StationMap — Interactive Leaflet world map showing:
 * - Current station position (animated glowing marker)
 * - 90-min orbital ground track polyline
 * - Signal footprint circle
 *
 * Uses a dark CartoDB tile layer for the space aesthetic.
 */
const StationMap = ({ data, station }) => {
  const mapRef      = useRef(null);
  const leafletRef  = useRef(null); // Leaflet map instance
  const markerRef   = useRef(null);
  const trackRef    = useRef(null);
  const footRef     = useRef(null);

  const stationColor = station === 'iss' ? '#00d4ff' : '#f97316';
  const stationLabel = station === 'iss' ? 'ISS' : 'Tiangong';

  // Initialize map once
  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (leafletRef.current || !mapRef.current) return;

      if (!L) {
        const leaflet = await import('leaflet');
        L = leaflet.default || leaflet;
      }

      if (!mounted || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [0, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
      });

      // Dark CartoDB tile layer
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 6, subdomains: 'abcd' }
      ).addTo(map);

      leafletRef.current = map;
    };

    initMap();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!leafletRef.current || !data || !L) return;

    const map = leafletRef.current;
    const lat = data.latitude;
    const lon = data.longitude;
    const footprintKm = data.footprint || 4500;

    // ── Marker ────────────────────────────────────────────────
    const markerHtml = `
      <div style="position:relative; width:24px; height:24px;">
        <div style="
          position:absolute; inset:-8px;
          border-radius:50%;
          border:2px solid ${stationColor};
          opacity:0.4;
          animation:pulse-glow 1.5s ease-in-out infinite;
        "></div>
        <div style="
          width:24px; height:24px;
          border-radius:50%;
          background:${stationColor};
          display:flex; align-items:center; justify-content:center;
          font-size:10px; font-weight:700; color:#000;
          box-shadow:0 0 12px ${stationColor};
        ">${stationLabel === 'ISS' ? '🛸' : '🚀'}</div>
      </div>`;

    const icon = L.divIcon({
      className: '',
      html: markerHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon], { icon })
        .bindTooltip(stationLabel, {
          permanent: false,
          direction: 'top',
          offset: [0, -16],
          className: '',
        })
        .addTo(map);
    }

    // ── Orbital Ground Track ──────────────────────────────────
    if (data.orbitPath && data.orbitPath.length > 1) {
      // Split track at antimeridian crossings (lon jumps > 180°)
      const segments = [];
      let current = [];
      for (let i = 0; i < data.orbitPath.length; i++) {
        const pt = data.orbitPath[i];
        if (
          current.length > 0 &&
          Math.abs(pt.lon - current[current.length - 1].lon) > 180
        ) {
          segments.push(current);
          current = [];
        }
        current.push(pt);
      }
      if (current.length > 0) segments.push(current);

      if (trackRef.current) {
        trackRef.current.forEach(l => map.removeLayer(l));
      }

      trackRef.current = segments.map((seg, i) =>
        L.polyline(
          seg.map(p => [p.lat, p.lon]),
          {
            color: stationColor,
            weight: i === 0 ? 2.5 : 1.5,
            opacity: i === 0 ? 0.9 : 0.4,
            dashArray: i === 0 ? null : '4 6',
          }
        ).addTo(map)
      );
    }

    // ── Footprint Circle ─────────────────────────────────────
    if (footRef.current) map.removeLayer(footRef.current);
    footRef.current = L.circle([lat, lon], {
      radius: (footprintKm / 2) * 1000, // metres
      color: stationColor,
      fillColor: stationColor,
      fillOpacity: 0.04,
      weight: 1,
      opacity: 0.3,
      dashArray: '3 6',
    }).addTo(map);

  }, [data, station]);

  return (
    <div className="glass-panel animate-fade-in" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '1rem 1.5rem 0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          🗺️ Live Orbital Position
        </h3>
        {data && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {data.latitude?.toFixed(4)}°, {data.longitude?.toFixed(4)}°
          </span>
        )}
      </div>
      <div
        ref={mapRef}
        id={`station-map-${station}`}
        style={{ width: '100%', height: '360px' }}
      />
    </div>
  );
};

export default StationMap;
