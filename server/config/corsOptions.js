/**
 * CORS whitelist for browser clients. Bearer auth does not rely on cookies.
 * Set CORS_ORIGINS to a comma-separated list of allowed origins (e.g. https://app.example.com,http://localhost:5173).
 * Optional: CORS_ALLOW_VERCEL_PREVIEWS=1 allows any https://*.vercel.app origin (for Preview deployments).
 * If unset in development, all origins are allowed. In production, unset still allows all but logs a warning.
 */
module.exports = function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS || '';
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const allowVercelPreviews = process.env.CORS_ALLOW_VERCEL_PREVIEWS === '1';

  function originAllowed(origin) {
    if (!origin) return true;
    if (list.includes(origin)) return true;
    if (allowVercelPreviews) {
      try {
        const { protocol, hostname } = new URL(origin);
        if (protocol === 'https:' && hostname.endsWith('.vercel.app')) return true;
      } catch (_) {
        /* ignore */
      }
    }
    return false;
  }

  return {
    origin(origin, callback) {
      if (list.length === 0) {
        if (process.env.NODE_ENV === 'production') {
          console.warn(
            '[cors] CORS_ORIGINS is empty — any website can call your API from a browser. Set CORS_ORIGINS in production.'
          );
        }
        return callback(null, true);
      }
      if (!origin) return callback(null, true);
      if (originAllowed(origin)) return callback(null, true);
      if (process.env.NODE_ENV === 'production') {
        console.warn('[cors] blocked origin:', origin, '| allowList:', list);
      }
      return callback(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  };
};
