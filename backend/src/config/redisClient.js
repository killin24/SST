import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  RESP: 2,
  socket: {
    reconnectStrategy: false
  }
});

let isRedisConnected = false;

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
  isRedisConnected = false;
});

redisClient.on('connect', () => {
  console.log('Connected to Redis successfully!');
  isRedisConnected = true;
});

(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis on startup. Will fallback to API.', error.message);
  }
})();

export const isRedisReady = () => isRedisConnected;
export { redisClient };
