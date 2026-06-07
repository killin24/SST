import { getTelemetry as fetchTelemetryService } from '../services/issServices.js';

export const getTelemetry = async (req, res, next) => {
  try {
    const result = await fetchTelemetryService();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
