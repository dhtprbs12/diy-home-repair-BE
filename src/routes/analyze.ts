import { Router, Request, Response } from 'express';
import multer from 'multer';
import { analyzeRepair } from '../services/geminiService';
import { processImage, isValidImageType, isValidFileSize } from '../utils/imageUtils';
import { analyzeRateLimiter } from '../middleware/rateLimiter';
import { logAnalyzeRequest, logError } from '../middleware/logger';
import { RepairMetadata, APIResponse, AnalysisResult } from '../types';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 4,
  },
});

// POST /analyze - Main analysis endpoint
router.post(
  '/',
  analyzeRateLimiter,
  upload.array('images', 4),
  async (req: Request, res: Response) => {
    const requestId = (req as any).requestId || 'unknown';

    try {
      const files = req.files as Express.Multer.File[];
      const metadataStr = req.body.metadata;

      // Log request (no image data)
      logAnalyzeRequest(files?.length || 0, !!metadataStr, requestId);

      // Validate images (optional, but max 4)
      if (files && files.length > 4) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 4 images allowed',
          timestamp: new Date().toISOString(),
        } as APIResponse<null>);
      }

      // Validate each file if provided
      if (files) {
        for (const file of files) {
          if (!isValidImageType(file.mimetype)) {
            return res.status(400).json({
              success: false,
              error: `Invalid file type: ${file.mimetype}. Only images are allowed.`,
              timestamp: new Date().toISOString(),
            } as APIResponse<null>);
          }

          if (!isValidFileSize(file.size)) {
            return res.status(400).json({
              success: false,
              error: 'File too large. Maximum 20MB per image.',
              timestamp: new Date().toISOString(),
            } as APIResponse<null>);
          }
        }
      }

      // Parse metadata
      let metadata: RepairMetadata;
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid metadata format',
          timestamp: new Date().toISOString(),
        } as APIResponse<null>);
      }

      // Validate metadata fields
      if (!metadata.description || metadata.description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Description is required',
          timestamp: new Date().toISOString(),
        } as APIResponse<null>);
      }

      // Process images if provided (resize, compress, strip EXIF)
      let imageBuffers: Buffer[] = [];
      let mimeTypes: string[] = [];

      if (files && files.length > 0) {
        const processedImages = await Promise.all(
          files.map(async (file) => {
            return processImage(file.buffer);
          })
        );
        imageBuffers = processedImages.map((img) => img.buffer);
        mimeTypes = processedImages.map((img) => img.mimeType);
      }

      // Call Gemini API
      const result = await analyzeRepair(
        imageBuffers,
        mimeTypes,
        metadata
      );

      // Return success response
      return res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      } as APIResponse<AnalysisResult>);

    } catch (error) {
      const err = error as Error;
      logError(err, requestId);

      return res.status(500).json({
        success: false,
        error: 'Analysis failed. Please try again.',
        timestamp: new Date().toISOString(),
      } as APIResponse<null>);
    }
  }
);

export default router;

