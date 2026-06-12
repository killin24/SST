import express from 'express';
import crypto  from 'crypto';
import Razorpay from 'razorpay';
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
    const historyData = await redisClient.zRange(
      `history_${station}`, 
      '-inf', 
      '+inf', 
      { BY: 'SCORE' }
    );

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

// ─────────────────────────────────────────────────────────────
// POST /api/payment/order
// Creates a Razorpay order server-side. The KEY_SECRET never
// leaves the backend. Returns { orderId, amount, currency }.
// Body: { amount: number (in rupees) }
// ─────────────────────────────────────────────────────────────
router.post('/payment/order', async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Payment gateway not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.' });
    }

    // Lazy instantiation — only created when a payment is actually requested
    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const { amount } = req.body;

    // Validate: amount must be a positive number
    const rupees = Number(amount);
    if (!rupees || rupees <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Provide a positive number in rupees.' });
    }

    const paise = Math.round(rupees * 100); // Razorpay works in paise
    if (paise < 100) {
      return res.status(400).json({ error: 'Minimum amount is Rs.1 (100 paise).' });
    }

    const order = await razorpay.orders.create({
      amount:   paise,
      currency: 'INR',
      receipt:  `sst_${Date.now()}`,
    });

    console.log(`[Payment] Order created: ${order.id} — Rs.${rupees}`);

    // Return only safe, non-secret fields
    // key_id is the PUBLIC key — safe to send to the frontend
    return res.status(201).json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error('[Payment /order] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/payment/verify
// Verifies the Razorpay HMAC-SHA256 signature after checkout.
// Prevents fake/spoofed payment confirmations.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// ─────────────────────────────────────────────────────────────
router.post('/payment/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields.' });
    }

    // Algorithm: HMAC-SHA256( order_id + "|" + payment_id , KEY_SECRET )
    const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    // timingSafeEqual prevents timing-based side-channel attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpay_signature)
    );

    if (!isValid) {
      console.warn(`[Payment /verify] INVALID signature for order ${razorpay_order_id}`);
      return res.status(400).json({ error: 'Signature verification failed. Payment not authorised.' });
    }

    console.log(`[Payment /verify] Payment verified — ${razorpay_payment_id}`);

    // Add your business logic here:
    // e.g., unlock premium features, send email, store to DB

    return res.status(200).json({
      success:   true,
      paymentId: razorpay_payment_id,
      message:   'Payment verified successfully.',
    });

  } catch (err) {
    console.error('[Payment /verify] Error:', err.message);
    return res.status(500).json({ error: 'Payment verification failed.' });
  }
});
