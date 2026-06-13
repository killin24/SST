import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { redisClient, isRedisReady } from './config/redisClient.js';
import apiRoutes from './routes/api.js';
import errorHandler from './middleware/errorHandler.js';
import { getTelemetry, fetchSatrec, propagateSatrec } from './services/satelliteService.js';
import { getCrew } from './services/crewService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Wrap express app in HTTP Server for Socket.io
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
];

// On the live site (Render), the frontend and backend are the same origin
// so CORS isn't needed — but for safety allow any HTTPS origin too
const corsOriginFn = (origin, callback) => {
  // Same-origin requests (served by Express static) have no Origin header
  if (!origin) return callback(null, true);
  // Allow all localhost variants for local dev
  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  // Allow any HTTPS origin (covers Render, custom domains, etc.)
  if (origin.startsWith('https://')) return callback(null, true);
  callback(new Error(`CORS: origin ${origin} not allowed`));
};


// ─────────────────────────────────────────────────────────────
// Socket.io — real-time broadcast channel
// ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: corsOriginFn, methods: ['GET', 'POST'] },
});

// ─────────────────────────────────────────────────────────────
// Express Middleware
// ─────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://*.cartocdn.com"],
      imgSrc: [
        "'self'", "data:", "blob:",
        "https://*.basemaps.cartocdn.com",
        "https://*.cartocdn.com",
        "https://unpkg.com",
        "https://checkout.razorpay.com",
        "https://*.razorpay.com",
      ],
      connectSrc: [
        "'self'", "ws:", "wss:",
        "https://api.wheretheiss.at",
        "https://celestrak.org",
        "https://corquaid.github.io",
        "https://api.razorpay.com",
        "https://lumberjack.razorpay.com",
      ],
      frameSrc: ["https://api.razorpay.com", "https://*.razorpay.com"],
      fontSrc:   ["'self'", "https://fonts.gstatic.com"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(cors({ origin: corsOriginFn, methods: ['GET', 'POST'] }));
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use('/api', apiRoutes);
app.use(errorHandler);

// Serve Static Files from Vite build
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all route for React SPA
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// ─────────────────────────────────────────────────────────────
// Background Worker — Telemetry Fetcher for a Single Station
// ─────────────────────────────────────────────────────────────
const lastHistorySave = { iss: 0, tiangong: 0 };
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const fetchAndBroadcastStation = async (stationId) => {
  try {
    const { data } = await getTelemetry(stationId);

    // Cache the latest reading in Redis for new socket connections
    if (isRedisReady()) {
      try {
        const key = `telemetry_${stationId}`;
        await redisClient.set(key, JSON.stringify(data));

        // Downsample historical storage to 1 point per minute
        const now = Date.now();
        if (now - lastHistorySave[stationId] >= 60000) {
          const historyKey = `history_${stationId}`;
          const score = data.timestamp || now;
          const value = JSON.stringify(data);
          
          await redisClient.zAdd(historyKey, [{ score: Number(score), value }]);
          await redisClient.zRemRangeByScore(historyKey, '-inf', (now - HISTORY_RETENTION_MS).toString());
          
          lastHistorySave[stationId] = now;
        }

      } catch (err) {
        console.warn(`[Redis SET ${stationId}] ${err.message}`);
      }
    }

    // Broadcast to all connected clients
    io.emit('telemetry_update', { station: stationId, data });
  } catch (err) {
    console.error(`[Worker ${stationId}] ${err.message}`);

    // Fault tolerance: re-broadcast last known state
    if (isRedisReady()) {
      try {
        const cached = await redisClient.get(`telemetry_${stationId}`);
        if (cached) {
          io.emit('telemetry_update', {
            station: stationId,
            data: JSON.parse(cached),
            source: 'redis-fallback',
          });
        }
      } catch (_) {}
    }
  }
};

// ─────────────────────────────────────────────────────────────
// Background Worker — Crew Data
// ─────────────────────────────────────────────────────────────
const fetchAndBroadcastCrew = async () => {
  try {
    const { data } = await getCrew();
    io.emit('crew_update', data);
  } catch (err) {
    console.error('[Worker Crew]', err.message);
  }
};

// ─────────────────────────────────────────────────────────────
// Backfill Missing History
// ─────────────────────────────────────────────────────────────
const backfillHistory = async () => {
  // Wait up to 5 seconds for Redis to connect
  let retries = 50;
  while (!isRedisReady() && retries > 0) {
    await new Promise(r => setTimeout(r, 100));
    retries--;
  }
  
  if (!isRedisReady()) {
    console.warn('[Backfill] Redis not ready after 5s, aborting backfill.');
    return;
  }
  
  try {
    for (const stationId of ['iss', 'tiangong']) {
      const historyKey = `history_${stationId}`;
      const count = await redisClient.zCard(historyKey);
      
      // If we have less than a full 7 days of data (approx 10,000 mins), backfill 7 full days
      if (count < 10000) {
        console.log(`[Backfill] Simulating 7 days of historical orbit data for ${stationId}...`);
        await redisClient.del(historyKey); // Wipe partial history to prevent duplicates
        const satrecData = await fetchSatrec(stationId);
        
        const now = Date.now();
        const sevenDaysMins = 7 * 24 * 60;
        
        const promises = [];
        for (let i = 0; i < sevenDaysMins; i++) {
          const t = now - (i * 60000);
          try {
            const point = propagateSatrec(satrecData, new Date(t));
            promises.push(
              redisClient.zAdd(historyKey, [{ score: t, value: JSON.stringify(point) }]).catch(() => {})
            );
          } catch (e) {
            // ignore invalid points
          }
        }
        
        // Wait for all individual inserts to finish
        await Promise.all(promises);
        console.log(`[Backfill] ✅ Completed 7-day data generation for ${stationId}.`);
      }
    }
  } catch (err) {
    console.error('[Backfill] Error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────
// Background Polling Loops
// ─────────────────────────────────────────────────────────────

// Stagger ISS and Tiangong by 1.5 s to avoid thundering herd
const startWorkers = () => {
  // Run backfill first if needed
  backfillHistory();

  // ISS: immediate + every 5 s
  fetchAndBroadcastStation('iss');
  setInterval(() => fetchAndBroadcastStation('iss'), 5000);

  // Tiangong: offset by 1.5 s then every 5 s
  setTimeout(() => {
    fetchAndBroadcastStation('tiangong');
    setInterval(() => fetchAndBroadcastStation('tiangong'), 5000);
  }, 1500);

  // Crew: immediate + every 30 s
  fetchAndBroadcastCrew();
  setInterval(fetchAndBroadcastCrew, 30000);
};

// ─────────────────────────────────────────────────────────────
// Socket.io Connection Lifecycle
// ─────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Immediately send cached data for both stations
  if (isRedisReady()) {
    const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);

    for (const stationId of ['iss', 'tiangong']) {
      try {
        // Send latest point
        const cached = await redisClient.get(`telemetry_${stationId}`);
        if (cached) {
          socket.emit('telemetry_update', {
            station: stationId,
            data: JSON.parse(cached),
            source: 'redis',
          });
        }

        // Send historical timeseries (last 5 hours)
        const historyData = await redisClient.zRange(
          `history_${stationId}`, 
          fiveHoursAgo.toString(), 
          '+inf', 
          { BY: 'SCORE' }
        );
        
        if (historyData && historyData.length > 0) {
          const parsedHistory = historyData.map(str => JSON.parse(str));
          socket.emit('telemetry_history', {
            station: stationId,
            data: parsedHistory
          });
        }
      } catch (err) {
        console.warn(`[Socket connect ${stationId}]`, err.message);
      }
    }

    // Send crew data immediately
    try {
      const crewCached = await redisClient.get('crew_data');
      if (crewCached) socket.emit('crew_update', JSON.parse(crewCached));
    } catch (_) {}
  }

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startWorkers();
});