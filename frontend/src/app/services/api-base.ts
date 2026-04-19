const browserHost =
  typeof window !== 'undefined' && window.location.hostname
    ? window.location.hostname
    : 'localhost';

export const API_BASE_URL = `http://${browserHost}:8000/api`;
