import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize lazily to ensure dotenv has loaded
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

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

const CHAT_SYSTEM_PROMPT = `You are a friendly home repair expert chatting with a homeowner.

CRITICAL: Keep responses SHORT - 1-2 sentences max. Be direct and helpful.

RULES:
- Answer the specific question only
- Don't repeat info from the analysis
- No lengthy explanations unless asked
- Be encouraging but brief
- If dangerous, say "Call a pro" simply

GOOD: "Yes, you can use PVC cement instead - works great on plastic pipes."
BAD: "That's a great question! PVC cement is actually a wonderful alternative that many DIYers prefer because it's easier to work with than traditional methods. Here's what you need to know about using it..."

TONE: Helpful friend texting advice, not writing an essay.`;

export async function chatWithExpert(
  originalDescription: string,
  analysisContext: AnalysisContext,
  conversationHistory: ChatMessageDTO[],
  newMessage: string
): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  // Build context from the analysis
  const analysisSection = buildAnalysisSection(analysisContext);
  
  // Build conversation history
  const historySection = buildHistorySection(conversationHistory);
  
  const prompt = `${CHAT_SYSTEM_PROMPT}

---

ORIGINAL PROBLEM:
"${originalDescription}"

ANALYSIS YOU PROVIDED:
${analysisSection}

${historySection}

USER'S NEW QUESTION:
"${newMessage}"

Respond helpfully and conversationally:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up the response (remove any markdown formatting if present)
    return text.trim();
    
  } catch (error) {
    console.error('Chat API error:', error);
    throw new Error('Failed to get chat response');
  }
}

function buildAnalysisSection(context: AnalysisContext): string {
  const parts: string[] = [];
  
  if (context.problemShort) {
    parts.push(`Problem: ${context.problemShort}`);
  }
  
  if (context.summary) {
    parts.push(`Summary: ${context.summary}`);
  }
  
  if (context.materials && context.materials.length > 0) {
    parts.push(`Materials needed: ${context.materials.join(', ')}`);
  }
  
  if (context.tools && context.tools.length > 0) {
    parts.push(`Tools needed: ${context.tools.join(', ')}`);
  }
  
  if (context.steps && context.steps.length > 0) {
    parts.push(`Steps: ${context.steps.map((s, i) => `${i + 1}. ${s}`).join(' ')}`);
  }
  
  if (context.warnings && context.warnings.length > 0) {
    parts.push(`Warnings: ${context.warnings.join('; ')}`);
  }
  
  return parts.join('\n');
}

function buildHistorySection(history: ChatMessageDTO[]): string {
  if (!history || history.length === 0) {
    return '';
  }
  
  const lines = history.map(msg => {
    const role = msg.role === 'user' ? 'User' : 'You';
    return `${role}: ${msg.content}`;
  });
  
  return `CONVERSATION SO FAR:\n${lines.join('\n')}\n`;
}

