console.log('🚀 Starting server...');

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();
console.log('✅ Environment loaded');

import analyzeRouter from './routes/analyze';
console.log('✅ Analyze router loaded');
import chatRouter from './routes/chat';
console.log('✅ Chat router loaded');
import usersRouter from './routes/users';
console.log('✅ Users router loaded');
import { requestLogger } from './middleware/logger';
import { generalRateLimiter } from './middleware/rateLimiter';
import { testConnection, isDatabaseEnabled } from './database/db';
console.log('✅ All imports loaded');

const app = express();
const PORT = process.env.PORT || 3000;
console.log(`📌 PORT from env: ${process.env.PORT}, using: ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(generalRateLimiter);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Routes
app.use('/analyze', analyzeRouter);
app.use('/chat', chatRouter);
app.use('/users', usersRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DIY Home Repair API' });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'disabled';
  if (isDatabaseEnabled()) {
    const dbConnected = await testConnection();
    dbStatus = dbConnected ? 'connected' : 'disconnected';
  }
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Start server - bind to 0.0.0.0 for Railway/cloud deployment
const HOST = '0.0.0.0';
app.listen(Number(PORT), HOST, () => {
  console.log(`🔧 DIY Home Repair API Server running on ${HOST}:${PORT}`);
  console.log(`📍 Health check: /health`);
  console.log(`🔍 Analyze endpoint: POST /analyze`);
  console.log(`💬 Chat endpoint: POST /chat`);
});

