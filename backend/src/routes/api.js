import express from 'express';
import { getTelemetry } from '../services/satelliteService.js';
import { getCrew } from '../services/crewService.js';
import { redisClient, isRedisReady } from '../config/redisClient.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// ISS telemetry (REST fallback — primary channel is WebSockets)
router.get('/iss/telemetry', async (req, res, next) => {
  try {
    const result = await getTelemetry('iss');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Tiangong telemetry (REST fallback)
router.get('/tiangong/telemetry', async (req, res, next) => {
  try {
    const result = await getTelemetry('tiangong');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Crew data for all stations
router.get('/crew', async (req, res, next) => {
  try {
    const result = await getCrew();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// CSV Download for 7-day historical telemetry
router.get('/history/:station/download', async (req, res, next) => {
  try {
    const { station } = req.params;
    if (station !== 'iss' && station !== 'tiangong') {
      return res.status(400).json({ error: 'Invalid station ID' });
    }

    if (!isRedisReady()) {
      return res.status(503).json({ error: 'Database unavailable for historical data' });
    }

    // Fetch all historical data for the station
    const historyData = await redisClient.sendCommand([
      'ZRANGEBYSCORE', `history_${station}`, 
      '-inf', '+inf'
    ]);

    if (!historyData || historyData.length === 0) {
      return res.status(404).json({ error: 'No historical data found' });
    }

    // Convert to CSV
    const csvLines = [];
    // CSV Header
    csvLines.push('Timestamp,Latitude,Longitude,Altitude(km),Velocity(km/h),Solar_Lat,Solar_Lon,Visibility');

    for (const row of historyData) {
      try {
        const d = JSON.parse(row);
        const isoTime = new Date(d.timestamp).toISOString();
        csvLines.push(`${isoTime},${d.latitude},${d.longitude},${d.altitude},${d.velocity},${d.solar_lat},${d.solar_lon},${d.visibility}`);
      } catch (e) {
        // Skip malformed rows
      }
    }

    const csvContent = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${station}_telemetry_7days.csv"`);
    res.status(200).send(csvContent);

  } catch (err) {
    next(err);
  }
});

export default router;
