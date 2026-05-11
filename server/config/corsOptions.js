/**
 * CORS whitelist for browser clients. Bearer auth does not rely on cookies.
 * Set CORS_ORIGINS to a comma-separated list of allowed origins (e.g. https://app.example.com,http://localhost:5173).
 * If unset in development, all origins are allowed. In production, unset still allows all but logs a warning.
 */
module.exports = function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS || '';
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

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
      if (list.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  };
};
