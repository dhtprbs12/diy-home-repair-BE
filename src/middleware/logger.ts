import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
  error?: string;
  // Metadata fields (no PII or image data)
  imageCount?: number;
  hasMetadata?: boolean;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Attach request ID to request object
  (req as any).requestId = requestId;

  const log: RequestLog = {
    requestId,
    method: req.method,
    path: req.path,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Log request start
  console.log(`[${log.timestamp}] ${log.requestId} -> ${log.method} ${log.path}`);

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    log.duration = duration;
    log.statusCode = res.statusCode;

    // Log completion (without body content)
    console.log(`[${new Date().toISOString()}] ${log.requestId} <- ${log.statusCode} (${duration}ms)`);

    return originalSend.call(this, body);
  };

  next();
}

export function logAnalyzeRequest(imageCount: number, hasMetadata: boolean, requestId: string) {
  console.log(`[${new Date().toISOString()}] ${requestId} analyze: images=${imageCount}, hasMetadata=${hasMetadata}`);
}

export function logError(error: Error, requestId: string) {
  console.error(`[${new Date().toISOString()}] ${requestId} ERROR: ${error.message}`);
}

