import { useState, useEffect, useRef } from 'react';
import telemetryApi from '../api/telemetryApi';

/**
 * Custom Hook for ISS Telemetry
 * The Senior Way: Separation of Concerns. 
 * UI components shouldn't contain raw fetch logic or `setInterval` cleanups.
 */
export const useTelemetry = (pollingIntervalMs = 3000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]); // Store last 20 data points for charting
  
  // Use a ref to keep track of the interval so we can clear it safely
  const intervalRef = useRef(null);

  const fetchTelemetry = async () => {
    try {
      const response = await telemetryApi.get('/iss/telemetry');
      const rawData = response.data.data;
      
      const newData = {
        ...rawData,
        timestamp: rawData.timestamp || Date.now()
      };
      
      setData(newData);
      setError(null);
      
      // Keep only the last 20 data points for performance
      setHistory(prev => {
        const updated = [...prev, newData];
        if (updated.length > 20) {
          updated.shift();
        }
        return updated;
      });
      
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
      // Ensure we format the error nicely for the UI
      setError(err.response?.data?.message || err.message || 'Unknown network error');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    // Clear any existing interval first to prevent duplicate polling
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Fetch immediately, then set interval
    fetchTelemetry();
    intervalRef.current = setInterval(fetchTelemetry, pollingIntervalMs);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startPolling();
    
    // The Senior Way: Prevent Memory Leaks!
    // Cleanup function runs when component unmounts.
    return () => {
      stopPolling();
    };
  }, [pollingIntervalMs]);

  return { 
    data, 
    loading, 
    error, 
    history, 
    retry: fetchTelemetry 
  };
};
