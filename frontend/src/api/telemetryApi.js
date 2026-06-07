import axios from 'axios';

// The Senior Way: Centralize API configurations.
// Makes it easy to attach auth tokens or interceptors later.

const telemetryApi = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 5000,
});

export default telemetryApi;
