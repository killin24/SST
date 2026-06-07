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

  // Keep history buffer — max 30 points per station
  const appendHistory = (setter, point) => {
    setter(prev => {
      const next = [...prev, point];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };

  useEffect(() => {
    if (!socket) return;

    const handleTelemetry = (payload) => {
      const { station, data } = payload;
      const point = { ...data, timestamp: data.timestamp || Date.now() };

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

    socket.on('telemetry_update', handleTelemetry);
    socket.on('crew_update', handleCrew);

    return () => {
      socket.off('telemetry_update', handleTelemetry);
      socket.off('crew_update', handleCrew);
    };
  }, [socket]);

  return { issData, issHistory, tiangongData, tiangongHistory, crew };
};
