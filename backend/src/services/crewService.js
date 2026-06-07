import axios from 'axios';
import { redisClient, isRedisReady } from '../config/redisClient.js';

const CREW_API_URL = 'http://api.open-notify.org/astros.json';
const CREW_CACHE_KEY = 'crew_data';
const CREW_CACHE_TTL = 60; // 60 seconds

/**
 * Fetches current crew from open-notify.org and groups by craft.
 * Handles ISS and Tiangong (and any future crafts).
 */
export const getCrew = async () => {
  // Try Redis cache
  if (isRedisReady()) {
    try {
      const cached = await redisClient.get(CREW_CACHE_KEY);
      if (cached) return { data: JSON.parse(cached), source: 'redis' };
    } catch (err) {
      console.warn('[Crew Redis GET]', err.message);
    }
  }

  try {
    const response = await axios.get(CREW_API_URL, { timeout: 8000 });
    const { people, number } = response.data;

    // Group crew members by spacecraft
    const grouped = { iss: [], tiangong: [], other: [] };
    for (const person of people) {
      const craft = person.craft?.toLowerCase() || 'other';
      if (craft === 'iss') grouped.iss.push(person.name);
      else if (craft === 'tiangong') grouped.tiangong.push(person.name);
      else grouped.other.push({ name: person.name, craft: person.craft });
    }

    const data = { total: number, ...grouped };

    // Cache result
    if (isRedisReady()) {
      try {
        await redisClient.setEx(CREW_CACHE_KEY, CREW_CACHE_TTL, JSON.stringify(data));
      } catch (err) {
        console.warn('[Crew Redis SET]', err.message);
      }
    }

    return { data, source: 'api' };
  } catch (err) {
    throw new Error(`Failed to fetch crew data: ${err.message}`);
  }
};
