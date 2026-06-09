import { useState, useEffect, useRef } from 'react';

/**
 * useStationData — manages real-time telemetry for both ISS and Tiangong,
 * plus crew data, all via a single shared Socket.io connection passed in.
 *
 * @param {object} socket - the Socket.io client instance (ref.current)
 * @returns {{ issData, issHistory, tiangongData, tiangongHistory, crew }}
 */
export const useStationData = (socket) => {
  const [issData, setIssData]           = useState(null);
  const [issHistory, setIssHistory]     = useState([]);
  const [tiangongData, setTiangongData] = useState(null);
  const [tiangongHistory, setTiangongHistory] = useState([]);
  const [crew, setCrew] = useState({ iss: [], tiangong: [] });

  // Keep history buffer — max 400 points per station (allows ~5 hours of data + live updates)
  const appendHistory = (setter, point) => {
    setter(prev => {
      const next = [...prev, point];
      return next.length > 400 ? next.slice(-400) : next;
    });
  };

  useEffect(() => {
    if (!socket) return;

    const handleTelemetry = (payload) => {
      const { station, data } = payload;
      const point = { 
        ...data, 
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        altitude: Number(data.altitude),
        velocity: Number(data.velocity),
        timestamp: data.timestamp || Date.now() 
      };

      if (station === 'iss') {
        setIssData(point);
        appendHistory(setIssHistory, point);
      } else if (station === 'tiangong') {
        setTiangongData(point);
        appendHistory(setTiangongHistory, point);
      }
    };

    const handleCrew = (data) => {
      setCrew({ iss: data.iss || [], tiangong: data.tiangong || [] });
    };

    const handleHistory = (payload) => {
      const { station, data } = payload;
      const parsedData = data.map(d => ({
        ...d,
        latitude: Number(d.latitude),
        longitude: Number(d.longitude),
        altitude: Number(d.altitude),
        velocity: Number(d.velocity),
        timestamp: d.timestamp || Date.now()
      }));

      if (station === 'iss') {
        setIssHistory(parsedData);
      } else if (station === 'tiangong') {
        setTiangongHistory(parsedData);
      }
    };

    socket.on('telemetry_update', handleTelemetry);
    socket.on('telemetry_history', handleHistory);
    socket.on('crew_update', handleCrew);

    return () => {
      socket.off('telemetry_update', handleTelemetry);
      socket.off('telemetry_history', handleHistory);
      socket.off('crew_update', handleCrew);
    };
  }, [socket]);

  return { issData, issHistory, tiangongData, tiangongHistory, crew };
};
