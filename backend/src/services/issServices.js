import axios from 'axios';
import { redisClient, isRedisReady } from '../config/redisClient.js';
import dotenv from 'dotenv';
dotenv.config();

const ISS_API_URL = process.env.ISS_API_URL || 'https://api.wheretheiss.at/v1/satellites/25544';
const CACHE_KEY = 'iss_telemetry';
const CACHE_TTL = 2; 

export const getTelemetry = async () => {
  if (isRedisReady()) {
    try {
      const cachedData = await redisClient.get(CACHE_KEY);
      if (cachedData) {
        return { data: JSON.parse(cachedData), source: 'redis' };
      }
    } catch (error) {
      console.warn('Redis GET error, falling back to API:', error.message);
    }
  }

  try {
    const response = await axios.get(ISS_API_URL);
    const rawData = response.data;

    // The Senior Way: Normalize the API payload into a consistent contract for the frontend
    // Protects the frontend from breaking if the API source format changes.
    let data = { 
      latitude: null, 
      longitude: null, 
      velocity: null, 
      altitude: null,
      timestamp: rawData.timestamp ? Number(rawData.timestamp) * 1000 : Date.now()
    };
    
    if (rawData.iss_position) {
      // open-notify.org format
      data.latitude = Number(rawData.iss_position.latitude);
      data.longitude = Number(rawData.iss_position.longitude);
    } else if (rawData.latitude) {
      // wheretheiss.at format
      data.latitude = Number(rawData.latitude);
      data.longitude = Number(rawData.longitude);
      data.velocity = Number(rawData.velocity);
      data.altitude = Number(rawData.altitude);
    }

    if (isRedisReady()) {
      try {
        await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
      } catch (error) {
        console.warn('Redis SET error:', error.message);
      }
    }

    return { data, source: 'api' };
  } catch (error) {
    throw new Error(`Failed to fetch from ISS API: ${error.message}`);
  }
};