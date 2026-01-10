import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import analyzeRouter from './routes/analyze';
import chatRouter from './routes/chat';
import usersRouter from './routes/users';
import { requestLogger } from './middleware/logger';
import { generalRateLimiter } from './middleware/rateLimiter';
import { testConnection } from './database/db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      database: dbConnected ? 'connected' : 'disconnected',
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

// Start server
app.listen(PORT, () => {
  console.log(`🔧 DIY Home Repair API Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Analyze endpoint: POST http://localhost:${PORT}/analyze`);
  console.log(`💬 Chat endpoint: POST http://localhost:${PORT}/chat`);
});

