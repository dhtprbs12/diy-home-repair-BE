import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10);

export const analyzeRateLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    success: false,
    error: 'Too many requests. Please wait before trying again.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if behind proxy, otherwise use IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
           req.ip || 
           'unknown';
  },
});

export const generalRateLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests.',
    timestamp: new Date().toISOString(),
  },
});

