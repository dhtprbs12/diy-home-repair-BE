// Answer to a clarifying question
export interface QuestionAnswer {
  question: string;
  answer: string;
}

// Home Profile information
export interface HomeProfile {
  email?: string;
  nickname?: string;
  homeType?: string;
  yearBuilt?: string;
  pipeType?: string;
  waterHeaterType?: string;
  hvacType?: string;
  hvacAge?: string;
  roofType?: string;
  roofAge?: string;
  mainFlooring?: string;
}

// Request metadata from iOS app
export interface RepairMetadata {
  description: string;
  location?: 'indoor' | 'outdoor';
  waterExposure?: 'none' | 'occasionally' | 'frequently' | 'submerged' | 'unknown';
  gettingWorse?: 'yes' | 'no' | 'unknown';
  surfaceCondition?: 'yes' | 'no' | 'unknown'; // loose/hollow sound
  repairGoal?: 'temporary' | 'permanent' | 'cosmetic' | 'unknown';
  // Conversation history for iterative questioning
  conversationHistory?: QuestionAnswer[];
  // Home profile for personalized advice
  homeProfile?: HomeProfile;
  // Legacy field
  previousAnswers?: QuestionAnswer[];
}

// Photo slot types
export type PhotoSlotType = 'wide' | 'closeup' | 'angled' | 'scale';

// Material item in response
export interface MaterialItem {
  item: string;
  qty: string;
  description: string;
  estimatedCost: string; // e.g., "$5-10"
  // Legacy fields (optional)
  spec?: string;
  howToUse?: string;
}

// Tool item in response
export interface ToolItem {
  name: string;
  description: string;
  // Legacy field (optional)
  howToUse?: string;
}

// Clarifying question with free text + suggestions
export interface ClarifyingQuestion {
  question: string;
  suggestions: string[];
}

// Legacy follow-up question (kept for compatibility)
export interface FollowupQuestion {
  question: string;
  whyItMatters: string;
  whatToUpload: string;
}

// Damage assessment
export interface DamageAssessment {
  type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  affectedArea: string;
}

// Full analysis result from Gemini
export interface AnalysisResult {
  // Two-step flow fields
  needsMoreInfo: boolean;
  questions: ClarifyingQuestion[];
  
  // Core fields
  summary: string;
  confidence: number; // 0-1
  confidenceLevel: 'high' | 'medium' | 'low';
  
  // Visual summary tags (new)
  problemShort: string; // 3-5 words max
  diyFriendly: 'yes' | 'maybe' | 'no';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string; // e.g., "30 min", "1-2 hours"
  estimatedCost: string; // e.g., "$25-40" total for all materials
  proEstimate: string; // e.g., "$150-300" estimated cost to hire a professional
  
  // Full analysis fields (empty when needsMoreInfo is true)
  immediateActions: string[];
  damage: DamageAssessment;
  materials: MaterialItem[];
  tools: ToolItem[];
  steps: string[];
  cureTimeNotes: string;
  warnings: string[];
  callAProIf: string[];
  
  // Video tutorial
  youtubeSearchQuery: string; // Search query to find tutorial on YouTube
  
  // Find a pro
  proType: string; // Type of professional needed (e.g., "plumber", "electrician")
  
  // Smart starter questions for follow-up chat
  suggestedQuestions: string[]; // 2-3 contextual questions user might want to ask
  
  // Legacy fields
  followups: FollowupQuestion[];
  additionalPhotosNeeded: boolean;
}

// API Response wrapper
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

