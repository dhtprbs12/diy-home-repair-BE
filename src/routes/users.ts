import { Router, Request, Response, NextFunction } from 'express';
import { findOrCreateUser, updateUserEmail, saveHomeProfile, saveAnalysis, getUserAnalyses, isDatabaseEnabled } from '../database/db';

const router = Router();

// Middleware to check if database is available
const requireDatabase = (req: Request, res: Response, next: NextFunction) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({
      success: false,
      error: 'Database not configured. User features are disabled.'
    });
  }
  next();
};

// Apply to all routes
router.use(requireDatabase);

// Register or login user (by email and/or device_id)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, deviceId } = req.body;
    
    if (!email && !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Either email or deviceId is required'
      });
    }
    
    const user = await findOrCreateUser(email, deviceId);
    
    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        isNew: !user.email && !user.device_id
      }
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
});

// Update user email
router.put('/:userId/email', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    await updateUserEmail(userId, email);
    
    res.json({
      success: true,
      message: 'Email updated successfully'
    });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update email'
    });
  }
});

// Save home profile
router.post('/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = req.body;
    
    const savedProfile = await saveHomeProfile(userId, {
      nickname: profile.nickname,
      home_type: profile.homeType,
      year_built: profile.yearBuilt,
      pipe_type: profile.pipeType,
      water_heater_type: profile.waterHeaterType,
      hvac_type: profile.hvacType,
      hvac_age: profile.hvacAge,
      roof_type: profile.roofType,
      roof_age: profile.roofAge,
      flooring_type: profile.mainFlooring
    });
    
    res.json({
      success: true,
      data: savedProfile
    });
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save profile'
    });
  }
});

// Save analysis result
router.post('/:userId/analyses', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const analysis = req.body;
    
    const savedAnalysis = await saveAnalysis(userId, {
      description: analysis.description,
      had_photos: analysis.hadPhotos || false,
      problem_short: analysis.problemShort,
      confidence: analysis.confidence,
      confidence_level: analysis.confidenceLevel,
      diy_friendly: analysis.diyFriendly,
      difficulty: analysis.difficulty,
      estimated_time: analysis.estimatedTime,
      estimated_cost: analysis.estimatedCost,
      pro_estimate: analysis.proEstimate,
      summary: analysis.summary,
      materials: analysis.materials,
      tools: analysis.tools,
      steps: analysis.steps,
      warnings: analysis.warnings,
      call_a_pro_if: analysis.callAProIf,
      youtube_search_query: analysis.youtubeSearchQuery,
      pro_type: analysis.proType
    });
    
    res.json({
      success: true,
      data: savedAnalysis
    });
  } catch (error) {
    console.error('Save analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save analysis'
    });
  }
});

// Get user's analyses
router.get('/:userId/analyses', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const analyses = await getUserAnalyses(userId);
    
    res.json({
      success: true,
      data: analyses
    });
  } catch (error) {
    console.error('Get analyses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analyses'
    });
  }
});

export default router;

