import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { RepairMetadata, AnalysisResult, ClarifyingQuestion } from '../types';

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

const SYSTEM_PROMPT = `You are an expert home repair diagnostic assistant. Your job is to understand the user's problem and provide helpful repair guidance.

DIAGNOSTIC APPROACH:
1. Read ALL available information (description + any Q&A history)
2. Assess: Can I confidently diagnose this problem?
3. If diagnosis is unclear: Ask 2-3 focused questions
4. If diagnosis is clear: Provide full repair analysis

---

CONFIDENCE = How well can I diagnose this problem?

Assess based on DIAGNOSTIC CLARITY, not how many questions were answered:

HIGH (0.8-0.95):
- Can identify the specific problem (e.g., "leaking P-trap connection")
- Know the likely cause
- Can recommend exact materials and steps
- Example: "Water under sink, dripping from pipe connection" → 0.85

MEDIUM (0.6-0.75):
- Probable problem identified but some uncertainty
- General category known but specifics unclear
- Can give guidance but with caveats
- Example: "Water under sink, not sure where from" → 0.65

LOW (0.3-0.5):
- Multiple possible causes
- Location or nature of problem unclear
- Need more details before recommending fix
- Example: "Water on my floor somewhere" → 0.35

---

IF CONFIDENCE < 0.7 (need more diagnostic info), return:
{
  "needsMoreInfo": true,
  "confidence": <your diagnostic confidence 0.0-1.0>,
  "summary": "Brief assessment based on current info",
  "questions": [
    {
      "question": "Question to clarify diagnosis",
      "suggestions": ["Option 1", "Option 2", "Option 3"]
    }
  ]
}

Question rules:
- Ask 2-3 questions that will help DIAGNOSE the problem
- Questions should be specific to THIS problem
- Each question has 3-4 suggested answers
- Focus on: location, symptoms, timing, visible damage

---

IF CONFIDENCE >= 0.7 (can diagnose), return:
{
  "needsMoreInfo": false,
  "confidence": <your diagnostic confidence 0.0-1.0>,
  "problemShort": "3-5 word problem description",
  "diyFriendly": "yes|maybe|no",
  "difficulty": "easy|medium|hard",
  "estimatedTime": "time estimate like '30 min' or '1-2 hours'",
  "estimatedCost": "total material cost range like '$20-35'",
  "proEstimate": "estimated professional service cost like '$150-300'",
  "summary": "1-2 sentences with more detail if needed",
  "damage": {
    "type": "Type of damage",
    "severity": "minor|moderate|severe|critical",
    "affectedArea": "Location"
  },
  "materials": [
    { "item": "Material name", "qty": "Amount needed", "description": "What it's for", "estimatedCost": "$X-Y" }
  ],
  "tools": [
    { "name": "Tool name", "description": "What it's used for" }
  ],
  "steps": ["Step 1", "Step 2", "..."],
  "cureTimeNotes": "Drying time if applicable",
  "warnings": ["Safety warnings"],
  "callAProIf": ["When to call professional"],
  "youtubeSearchQuery": "specific YouTube search query for this repair",
  "proType": "type of professional if needed (plumber, electrician, etc.) or empty if DIY",
  "suggestedQuestions": ["Question 1?", "Question 2?", "Question 3?"]
}

VISUAL SUMMARY RULES:
- problemShort: Max 5 words (e.g., "Loose pipe fitting", "Clogged drain", "Cracked grout")
- diyFriendly: "yes" (safe & easy), "maybe" (doable but tricky), "no" (call a pro)
- difficulty: "easy" (basic tools, <1hr), "medium" (some skill needed), "hard" (experienced DIYers)
- estimatedTime: Realistic time (e.g., "15 min", "30 min", "1-2 hours", "half day")
- estimatedCost: Total for all materials (e.g., "$15-25", "$30-50"). Be realistic for US prices.
- proEstimate: What a professional would charge (labor + materials). Be realistic:
  - Simple repairs (faucet, toilet, outlet): $100-200
  - Medium repairs (water heater, drain clearing): $200-400
  - Complex repairs (pipe replacement, electrical panel): $400-800+
  - Always give a range (e.g., "$150-250", "$300-500")

MATERIALS: Include estimatedCost for each item (e.g., "$5-10", "$12-18"). 2-5 materials, 2-4 tools, 3-7 steps max.
Use simple, common names for materials that customers can easily find at a store.

YOUTUBE SEARCH QUERY:
- Create a specific search query that would find a helpful DIY tutorial video
- Be specific to the exact repair (e.g., "how to fix leaky P-trap under sink" not "plumbing repair")
- Include key details: what's being fixed, where, method if relevant
- Keep it natural, like how someone would actually search YouTube

PRO TYPE:
- If diyFriendly is "no" or "maybe", specify the type of professional needed
- Use simple terms: "plumber", "electrician", "HVAC technician", "roofer", "handyman", "general contractor"
- Leave empty string "" if this is a straightforward DIY repair

SUGGESTED QUESTIONS:
- Generate 2-3 follow-up questions the user might want to ask about THIS specific repair
- Make them practical and helpful, like:
  - "What if [specific issue] happens?"
  - "Can I use [alternative material]?"
  - "How long will this repair last?"
  - "What should I do if [common problem]?"
- Keep questions short (under 10 words)
- Make them specific to the repair, not generic`;

export async function analyzeRepair(
  imageBuffers: Buffer[],
  imageMimeTypes: string[],
  metadata: RepairMetadata
): Promise<AnalysisResult> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Build the prompt with metadata context
  const hasImages = imageBuffers.length > 0;
  const userPrompt = buildUserPrompt(metadata, hasImages);

  // Convert images to Gemini format (if any)
  const imageParts: Part[] = imageBuffers.map((buffer, index) => ({
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: imageMimeTypes[index] || 'image/jpeg',
    },
  }));

  // Combine text and images
  const parts: Part[] = [
    { text: SYSTEM_PROMPT },
    ...imageParts,
    { text: userPrompt },
  ];

  try {
    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from Gemini response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Calculate confidence level
    const confidence = Math.min(1, Math.max(0, parsed.confidence || 0.5));
    const confidenceLevel = getConfidenceLevel(confidence);
    const needsMoreInfo = parsed.needsMoreInfo === true || confidence < 0.7;

    // Parse questions if present
    const questions: ClarifyingQuestion[] = (parsed.questions || []).map((q: any) => ({
      question: q.question || '',
      suggestions: Array.isArray(q.suggestions) ? q.suggestions : [],
    }));

    return {
      // Two-step flow
      needsMoreInfo,
      questions,
      
      // Core fields
      summary: parsed.summary || 'Unable to determine issue',
      confidence,
      confidenceLevel,
      
      // Visual summary tags
      problemShort: parsed.problemShort || '',
      diyFriendly: parsed.diyFriendly || 'maybe',
      difficulty: parsed.difficulty || 'medium',
      estimatedTime: parsed.estimatedTime || '',
      estimatedCost: parsed.estimatedCost || '',
      proEstimate: parsed.proEstimate || '',
      
      // Full analysis fields (may be empty if needsMoreInfo)
      immediateActions: parsed.immediateActions || [],
      damage: parsed.damage || { type: 'Unknown', severity: 'moderate', affectedArea: 'Unknown' },
      materials: (parsed.materials || []).map((m: any) => ({
        item: m.item || '',
        spec: m.spec || '',
        qty: m.qty || '',
        description: m.description || '',
        howToUse: m.howToUse || '',
        estimatedCost: m.estimatedCost || '',
      })),
      tools: (parsed.tools || []).map((t: any) => ({
        name: typeof t === 'string' ? t : t.name || '',
        description: typeof t === 'string' ? '' : t.description || '',
        howToUse: typeof t === 'string' ? '' : t.howToUse || '',
      })),
      steps: parsed.steps || [],
      cureTimeNotes: parsed.cureTimeNotes || '',
      warnings: parsed.warnings || [],
      callAProIf: parsed.callAProIf || [],
      
      // Video tutorial
      youtubeSearchQuery: parsed.youtubeSearchQuery || '',
      
      // Find a pro
      proType: parsed.proType || '',
      
      // Suggested questions for follow-up chat
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) 
        ? parsed.suggestedQuestions.filter((q: string) => q && q.length > 0)
        : [],
      
      // Legacy
      followups: [],
      additionalPhotosNeeded: needsMoreInfo,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to analyze images with AI');
  }
}

function buildUserPrompt(metadata: RepairMetadata, hasImages: boolean): string {
  const hasConversation = metadata.conversationHistory && metadata.conversationHistory.length > 0;
  const roundNumber = hasConversation ? Math.ceil(metadata.conversationHistory!.length / 3) + 1 : 1;
  const maxRounds = 3;
  
  // Build home profile section
  let profileSection = '';
  if (metadata.homeProfile && Object.keys(metadata.homeProfile).length > 0) {
    const profile = metadata.homeProfile;
    const profileLines: string[] = [];
    if (profile.homeType) profileLines.push(`- Home Type: ${profile.homeType}`);
    if (profile.yearBuilt) profileLines.push(`- Year Built: ${profile.yearBuilt}`);
    if (profile.pipeType) profileLines.push(`- Pipe Type: ${profile.pipeType}`);
    if (profile.waterHeaterType) profileLines.push(`- Water Heater: ${profile.waterHeaterType}`);
    if (profile.hvacType) {
      let hvacLine = `- HVAC: ${profile.hvacType}`;
      if (profile.hvacAge) hvacLine += ` (${profile.hvacAge} old)`;
      profileLines.push(hvacLine);
    }
    if (profile.roofType) {
      let roofLine = `- Roof: ${profile.roofType}`;
      if (profile.roofAge) roofLine += ` (${profile.roofAge} old)`;
      profileLines.push(roofLine);
    }
    if (profile.mainFlooring) profileLines.push(`- Main Flooring: ${profile.mainFlooring}`);
    
    if (profileLines.length > 0) {
      profileSection = `
HOME PROFILE:
${profileLines.join('\n')}
(Use this info to personalize advice - e.g., old galvanized pipes need different approach than PEX, older homes may have lead paint, etc.)
`;
    }
  }
  
  // Build conversation history section
  let conversationSection = '';
  if (hasConversation) {
    const qaLines = metadata.conversationHistory!.map(
      (qa) => `Q: ${qa.question}\nA: ${qa.answer || "(skipped)"}`
    ).join('\n\n');
    conversationSection = `
PREVIOUS CONVERSATION:
${qaLines}
`;
  }

  const imageNote = hasImages
    ? '(User provided photos)'
    : '(No photos provided)';

  // Determine instruction based on round
  let instruction = '';
  if (roundNumber >= maxRounds) {
    instruction = `This is round ${roundNumber}/${maxRounds} (final). Provide your best analysis now based on all available information. Do NOT ask more questions.`;
  } else if (hasConversation) {
    instruction = `Round ${roundNumber}/${maxRounds}. Review ALL information above (description + answers). Assess your DIAGNOSTIC CONFIDENCE based on how clearly you can identify the problem - not just because questions were answered. If the answers helped clarify the diagnosis, confidence should be higher. If answers were vague or unhelpful, confidence may still be low.`;
  } else {
    instruction = `Round 1/${maxRounds}. Assess your diagnostic confidence. Can you identify the specific problem? If unclear, ask 2-3 questions to help diagnose.`;
  }

  return `
USER'S PROBLEM:
"${metadata.description}"
${imageNote}
${profileSection}${conversationSection}
---
${instruction}

Base your confidence on DIAGNOSTIC CLARITY - how well you can identify and fix the problem.
`;
}

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

