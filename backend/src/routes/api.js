import express from 'express';
import { getTelemetry } from '../services/satelliteService.js';
import { getCrew } from '../services/crewService.js';

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

export default router;
