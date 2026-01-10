import sharp from 'sharp';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 75;

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
}

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  try {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    
    let pipeline = sharp(buffer);

    // Remove EXIF data by default
    pipeline = pipeline.rotate(); // Auto-rotate based on EXIF then strip it

    // Resize if necessary
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const maxDim = Math.max(width, height);

    if (maxDim > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG with compression
    const processedBuffer = await pipeline
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    return {
      buffer: processedBuffer,
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image');
  }
}

export function isValidImageType(mimeType: string): boolean {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  return validTypes.includes(mimeType.toLowerCase());
}

export function isValidFileSize(sizeBytes: number, maxMB: number = 20): boolean {
  return sizeBytes <= maxMB * 1024 * 1024;
}

