import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { chatWithExpert } from '../services/chatService';

const router = Router();

interface ChatMessageDTO {
  role: 'user' | 'assistant';
  content: string;
}

interface AnalysisContext {
  problemShort: string;
  summary: string;
  materials: string[];
  tools: string[];
  steps: string[];
  warnings: string[];
}

interface ChatRequestBody {
  originalDescription: string;
  analysisContext: AnalysisContext;
  conversationHistory: ChatMessageDTO[];
  newMessage: string;
}

router.post('/', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] ${requestId} -> POST /chat`);
  
  try {
    const body = req.body as ChatRequestBody;
    
    // Validate required fields
    if (!body.newMessage || body.newMessage.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }
    
    if (!body.originalDescription) {
      return res.status(400).json({
        success: false,
        error: 'Original description is required',
      });
    }
    
    console.log(`[${new Date().toISOString()}] ${requestId} chat: message="${body.newMessage.substring(0, 50)}..."`);
    
    // Get AI response
    const response = await chatWithExpert(
      body.originalDescription,
      body.analysisContext,
      body.conversationHistory || [],
      body.newMessage
    );
    
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${requestId} <- 200 (${duration}ms)`);
    
    return res.json({
      success: true,
      response,
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] ${requestId} ERROR:`, error);
    console.log(`[${new Date().toISOString()}] ${requestId} <- 500 (${duration}ms)`);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
    });
  }
});

export default router;

