import axios from 'axios';
import * as satellite from 'satellite.js';
import { redisClient, isRedisReady } from '../config/redisClient.js';
import dotenv from 'dotenv';
dotenv.config();

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────
const ISS_API_URL = process.env.ISS_API_URL || 'https://api.wheretheiss.at/v1/satellites/25544';

// CelesTrak GP endpoint — returns CSV with all orbital elements
const TLE_GP_URL = (catNum) =>
  `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catNum}&FORMAT=TLE`;

const NORAD_IDS = { iss: 25544, tiangong: 48274 };

// In-memory TLE cache (refreshed every 15 minutes)
const tleCache = { iss: null, tiangong: null, lastFetched: { iss: 0, tiangong: 0 } };
const TLE_CACHE_MS = 15 * 60 * 1000;

// Redis keys
const CACHE_KEYS = { iss: 'telemetry_iss', tiangong: 'telemetry_tiangong' };
const CACHE_TTL = 5; // seconds

// ─────────────────────────────────────────────────────────────
// GP CSV → satellite.js record
// ─────────────────────────────────────────────────────────────

/**
 * Convert CelesTrak GP CSV row into a satellite.js satrec directly
 * using twoline2satrec after reconstructing proper TLE lines.
 */
const parseCsvToSatrec = (csvText) => {
  const lines  = csvText.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('Invalid CSV response from CelesTrak');

  const headers = lines[0].split(',').map(h => h.trim());
  const values  = lines[1].split(',').map(v => v.trim());
  const row = {};
  headers.forEach((h, i) => { row[h] = values[i]; });

  const name      = (row['OBJECT_NAME'] || 'SATELLITE').trim();
  const catNum    = String(row['NORAD_CAT_ID'] || '0').padStart(5, '0');
  const epochStr  = row['EPOCH'] || '';
  const inc       = parseFloat(row['INCLINATION'] || 0);
  const raan      = parseFloat(row['RA_OF_ASC_NODE'] || 0);
  const ecc       = parseFloat(row['ECCENTRICITY'] || 0);
  const argPeri   = parseFloat(row['ARG_OF_PERICENTER'] || 0);
  const ma        = parseFloat(row['MEAN_ANOMALY'] || 0);
  const mm        = parseFloat(row['MEAN_MOTION'] || 0);       // rev/day
  const rev       = parseInt(row['REV_AT_EPOCH'] || 0);
  const bstar     = parseFloat(row['BSTAR'] || 0);
  const ndot      = parseFloat(row['MEAN_MOTION_DOT'] || 0);
  const elementNo = parseInt(row['ELEMENT_SET_NO'] || 999) % 10000;
  const intlDes   = (row['OBJECT_ID'] || '98067A').replace(/-/g, '');
  const classType = (row['CLASSIFICATION_TYPE'] || 'U').trim();

  // Convert ISO epoch → TLE epoch (YYDDD.DDDDDDDD)
  const eDate     = new Date(epochStr);
  const eYear     = eDate.getUTCFullYear();
  const eSoY      = new Date(Date.UTC(eYear, 0, 0));
  const eDoy      = (eDate - eSoY) / 86400000; // decimal day of year
  const tleYY     = String(eYear).slice(-2);
  const tleDoy    = eDoy.toFixed(8).padStart(12, '0');
  const tleEpoch  = `${tleYY}${tleDoy}`;

  // BSTAR in TLE exponential notation (e.g., " 12345-4")
  const fmtBstar  = bstar === 0 ? ' 00000-0' : formatTleExp(bstar);
  const fmtNdot   = ndot >= 0
    ? ` ${ndot.toFixed(8)}`
    : `-${Math.abs(ndot).toFixed(8)}`;

  // International designator: 2-digit year + launch no (3) + piece (3)
  const intlShort = intlDes.length >= 8 ? intlDes.slice(2, 9) : intlDes.padEnd(8, ' ');

  // Eccentricity without decimal point, 7 digits
  const eccStr = ecc.toFixed(7).replace('0.', '');

  const line1 = [
    `1 ${catNum}${classType}`,
    intlShort.padEnd(8),
    tleEpoch,
    fmtNdot.padStart(10),
    ` 00000-0`,
    fmtBstar,
    `0`,
    String(elementNo).padStart(4),
  ].join(' ').replace(/\s+/g, ' ');

  const line2 = [
    `2 ${catNum}`,
    inc.toFixed(4).padStart(8),
    raan.toFixed(4).padStart(8),
    eccStr,
    argPeri.toFixed(4).padStart(8),
    ma.toFixed(4).padStart(8),
    `${mm.toFixed(8).padStart(11)}${String(rev).padStart(5)}`,
  ].join(' ').replace(/\s+/g, ' ');

  // Build satrec directly from clean TLE lines
  const satrec = satellite.twoline2satrec(line1.trim(), line2.trim());
  return { name, satrec, meanMotion: mm, csvRow: row, line1, line2 };
};

const formatTleExp = (val) => {
  // Format a number in TLE mantissa/exponent form, e.g., " 34213-3"
  if (val === 0) return ' 00000-0';
  const exp = Math.floor(Math.log10(Math.abs(val)));
  const mant = val / Math.pow(10, exp);
  const mantStr = (mant * 100000).toFixed(0).replace('-', '').padStart(5, '0').slice(0, 5);
  const sign = val < 0 ? '-' : ' ';
  const expSign = exp >= 0 ? '+' : '-';
  return `${sign}${mantStr}${expSign}${Math.abs(exp)}`;
};

// ─────────────────────────────────────────────────────────────
// TLE Fetching (CelesTrak)
// ─────────────────────────────────────────────────────────────

// TLE line checksum: sum all digits + treat '-' as 1, mod 10
const tleChecksum = (line) => {
  let sum = 0;
  for (const c of line.slice(0, 68)) {
    if (c >= '0' && c <= '9') sum += parseInt(c, 10);
    else if (c === '-') sum += 1;
  }
  return sum % 10;
};

const fetchSatrec = async (stationId) => {
  const now = Date.now();
  if (tleCache[stationId] && now - tleCache.lastFetched[stationId] < TLE_CACHE_MS) {
    return tleCache[stationId];
  }

  const noradId = NORAD_IDS[stationId];
  if (!noradId) throw new Error(`Unknown station: ${stationId}`);

  // Force text/plain Accept header so CelesTrak returns 3-line TLE (not CSV)
  const response = await axios.get(TLE_GP_URL(noradId), {
    timeout: 12000,
    headers: {
      'User-Agent': 'SpaceDashboard/1.0',
      'Accept': 'text/plain, */*',
    },
    responseType: 'text',
  });

  const rawText = typeof response.data === 'string'
    ? response.data
    : JSON.stringify(response.data);

  const textLines = rawText.trim().split('\n').map(l => l.trim()).filter(Boolean);
  let result;

  if (textLines.length >= 3 && textLines[1].startsWith('1 ') && textLines[2].startsWith('2 ')) {
    // Proper 3-line TLE format from CelesTrak
    const line1 = textLines[1];
    const line2 = textLines[2];

    // Validate checksums (warn only — some sources omit them)
    const cs1 = parseInt(line1.slice(-1), 10);
    const cs2 = parseInt(line2.slice(-1), 10);
    if (cs1 !== tleChecksum(line1)) console.warn(`[TLE] Line1 checksum mismatch for ${stationId}`);
    if (cs2 !== tleChecksum(line2)) console.warn(`[TLE] Line2 checksum mismatch for ${stationId}`);

    const satrec = satellite.twoline2satrec(line1, line2);

    // Sanity check: propagate to NOW — throws if TLE is invalid
    const testPV = satellite.propagate(satrec, new Date());
    if (!testPV || !testPV.position) {
      throw new Error(`[TLE] SGP4 test propagation failed for ${stationId} — invalid TLE`);
    }

    const mm = parseFloat(line2.substring(52, 63));
    result = { name: textLines[0].trim(), satrec, meanMotion: mm, line1, line2 };

  } else if (rawText.includes('NORAD_CAT_ID') || rawText.includes('MEAN_MOTION')) {
    // Fallback: CSV GP format — parse manually
    result = parseCsvToSatrec(rawText);
  } else {
    throw new Error(`Unrecognised response format from CelesTrak for ${stationId}: ${rawText.slice(0, 80)}`);
  }

  tleCache[stationId] = result;
  tleCache.lastFetched[stationId] = now;
  console.log(`[TLE] ✅ Cached orbital data for ${stationId}: ${result.name}`);
  return result;
};

// ─────────────────────────────────────────────────────────────
// SGP4 Propagation → Telemetry Payload
// ─────────────────────────────────────────────────────────────

/**
 * Propagate satrec to current time and compute all telemetry fields.
 * Returns normalized payload.
 */
const propagateSatrec = (satrecData, atDate = new Date()) => {
  const { satrec, meanMotion, csvRow } = satrecData;

  const pv = satellite.propagate(satrec, atDate);
  if (!pv.position) throw new Error('SGP4 propagation failed — check TLE validity');

  const gmst = satellite.gstime(atDate);
  const geo  = satellite.eciToGeodetic(pv.position, gmst);

  const lat   = satellite.degreesLat(geo.latitude);
  const lon   = satellite.degreesLong(geo.longitude);
  const altKm = geo.height;

  // Velocity magnitude km/s → km/h
  const v = pv.velocity;
  const velocityKmH = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2) * 3600;

  // Footprint diameter (km) — Earth's visible circle from this altitude
  const EARTH_R = 6371;
  const footprintDiameter = 2 * EARTH_R * Math.acos(EARTH_R / (EARTH_R + altKm));

  // Orbital period (min)
  const mm = meanMotion || (csvRow ? parseFloat(csvRow['MEAN_MOTION'] || 0) : 0);
  const periodMin = mm > 0 ? 1440 / mm : 92;

  // Solar position (simplified)
  const dayOfYear = Math.floor((atDate - new Date(atDate.getFullYear(), 0, 0)) / 86400000);
  const solarLat  = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const solarLon  = ((dayOfYear / 365) * 360 - 180 + (atDate.getUTCHours() - 12) * 15) % 360;

  // Julian day
  const julianDay = atDate.getTime() / 86400000 + 2440587.5;

  // Simplified visibility check
  const solarZenith = Math.abs(lat - solarLat);
  const visibility  = solarZenith < 90 ? 'daylight' : 'eclipsed';

  // Ground track — next 90 minutes at 1-min intervals
  const orbitPath = [];
  for (let i = 0; i <= 90; i++) {
    const t    = new Date(atDate.getTime() + i * 60000);
    const pvt  = satellite.propagate(satrec, t);
    if (!pvt.position) continue;
    const gmstT = satellite.gstime(t);
    const geot  = satellite.eciToGeodetic(pvt.position, gmstT);
    orbitPath.push({
      lat: satellite.degreesLat(geot.latitude),
      lon: satellite.degreesLong(geot.longitude),
    });
  }

  return {
    latitude:  lat,
    longitude: lon,
    altitude:  altKm,
    velocity:  velocityKmH,
    visibility,
    footprint: footprintDiameter,
    solar_lat: solarLat,
    solar_lon: solarLon,
    daynum:    julianDay,
    period:    periodMin,
    orbitPath,
    timestamp: atDate.getTime(),
  };
};

// ─────────────────────────────────────────────────────────────
// ISS — wheretheiss.at API (richer fields) + TLE orbit path
// ─────────────────────────────────────────────────────────────

const fetchISSFromAPI = async () => {
  try {
    const response = await axios.get(ISS_API_URL, { timeout: 8000 });
    const r = response.data;

    // Use TLE propagation for orbit path (wheretheiss.at doesn't provide it)
    let orbitPath = [];
    let period = 92.68;
    try {
      const satrecData = await fetchSatrec('iss');
      const full = propagateSatrec(satrecData, new Date(Number(r.timestamp) * 1000));
      orbitPath  = full.orbitPath;
      period     = full.period;
    } catch (_) { /* orbit path non-critical */ }

    return {
      latitude:   Number(r.latitude),
      longitude:  Number(r.longitude),
      altitude:   Number(r.altitude),
      velocity:   Number(r.velocity),
      visibility: r.visibility || 'unknown',
      footprint:  Number(r.footprint),
      solar_lat:  Number(r.solar_lat),
      solar_lon:  Number(r.solar_lon),
      daynum:     Number(r.daynum),
      period,
      orbitPath,
      timestamp: Number(r.timestamp) * 1000,
    };
  } catch (apiErr) {
    // Fallback: use TLE propagation when wheretheiss.at is unreachable
    console.warn(`[ISS API] Direct API failed (${apiErr.message}), using TLE propagation fallback`);
    const satrecData = await fetchSatrec('iss');
    return propagateSatrec(satrecData);
  }
};

// ─────────────────────────────────────────────────────────────
// Tiangong — TLE + SGP4 (full propagation)
// ─────────────────────────────────────────────────────────────

const fetchTiangong = async () => {
  const satrecData = await fetchSatrec('tiangong');
  return propagateSatrec(satrecData);
};

// ─────────────────────────────────────────────────────────────
// Main Export — getTelemetry(stationId)
// ─────────────────────────────────────────────────────────────

export const getTelemetry = async (stationId = 'iss') => {
  try {
    const data = stationId === 'iss'
      ? await fetchISSFromAPI()
      : await fetchTiangong();

    return { data, source: 'api' };
  } catch (err) {
    throw new Error(`Failed to fetch ${stationId} telemetry: ${err.message}`);
  }
};
