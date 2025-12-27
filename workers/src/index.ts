/**
 * HF4A Card Scanner - Cloudflare Worker
 *
 * Accepts card images and identifies them using OpenAI Vision API (GPT-4.1-mini)
 * Authentication via invite code + device ID scheme
 *
 * Card names are dynamically fetched from https://hf4a.github.io/data/cards.json
 * to ensure the prompt always has the current valid card list.
 */

interface Env {
  OPENAI_API_KEY: string;
  ALLOWED_ORIGINS: string;
  DEFAULT_MODEL: string;
  AUTH_SALT: string;
  HF4A_AUTH: KVNamespace;
}

interface RegisterRequest {
  inviteCode: string;
  deviceId: string;
}

interface InviteData {
  ownerId: string;
  maxDevices: number;
  deviceCount: number;
  createdAt: number;
}

interface TokenData {
  inviteCode: string;
  deviceId: string;
  createdAt: number;
}

interface ScanRequest {
  image: string;  // Base64-encoded JPEG/PNG
  model?: 'nano' | 'mini' | 'full';  // GPT-5 variant
}

interface CardResult {
  card_type: string;
  card_name: string;
  side: string;
  confidence: number;
  ocr_text?: string;
  bbox?: [number, number, number, number];
}

interface ScanResponse {
  success: boolean;
  cards: CardResult[];
  gridRows?: number;  // Number of rows in detected card grid
  gridCols?: number;  // Number of columns in detected card grid
  model_used: string;
  tokens_used?: { input: number; output: number };
  latency_ms: number;
  error?: string;
}

// Card data from hf4a.github.io
interface CardData {
  id: string;
  name: string;
  type: string;
  side?: string;
  upgradeChain?: string[];
}

// Cache for card names (refreshed every 5 minutes)
let cardNamesCache: { byType: Record<string, string[]>; types: string[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch card data from production site and extract front-side names grouped by type
 */
async function getCardNames(): Promise<{ byType: Record<string, string[]>; types: string[] }> {
  // Return cached data if fresh
  if (cardNamesCache && (Date.now() - cardNamesCache.fetchedAt) < CACHE_TTL_MS) {
    return { byType: cardNamesCache.byType, types: cardNamesCache.types };
  }

  try {
    const response = await fetch('https://hf4a.github.io/data/cards.json', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error('Failed to fetch cards.json:', response.status);
      // Return cached data even if stale, or empty if no cache
      if (cardNamesCache) return { byType: cardNamesCache.byType, types: cardNamesCache.types };
      return { byType: {}, types: [] };
    }

    const cards: CardData[] = await response.json();

    // Group names by type, front sides only
    // Front side = where card.side matches upgradeChain[0] (the base/unpromoted side)
    const byType: Record<string, Set<string>> = {};

    for (const card of cards) {
      if (!card.type || !card.name) continue;

      // Determine if this is a front (base) side
      // Cards with upgradeChain: front side is upgradeChain[0]
      // Cards without upgradeChain: include them (single-sided cards)
      const isFrontSide = !card.upgradeChain ||
        card.upgradeChain.length === 0 ||
        card.side === card.upgradeChain[0];

      if (isFrontSide) {
        if (!byType[card.type]) byType[card.type] = new Set();
        byType[card.type].add(card.name);
      }
    }

    // Convert Sets to sorted arrays
    const result: Record<string, string[]> = {};
    const types = Object.keys(byType).sort();

    for (const type of types) {
      result[type] = [...byType[type]].sort();
    }

    // Update cache
    cardNamesCache = { byType: result, types, fetchedAt: Date.now() };
    console.log(`Card names cache refreshed: ${Object.values(result).flat().length} cards across ${types.length} types`);

    return { byType: result, types };
  } catch (err) {
    console.error('Error fetching card names:', err);
    if (cardNamesCache) return { byType: cardNamesCache.byType, types: cardNamesCache.types };
    return { byType: {}, types: [] };
  }
}

/**
 * Build the system prompt dynamically with current card names
 */
async function buildSystemPrompt(): Promise<string> {
  const { byType, types } = await getCardNames();

  // Build the valid names section
  let validNamesSection = '';
  if (types.length > 0) {
    validNamesSection = '\n=== VALID CARD NAMES (CLOSED SET - NO OTHER NAMES EXIST) ===\n\n';
    for (const type of types) {
      const names = byType[type];
      if (names && names.length > 0) {
        validNamesSection += `${type}: ${names.join(', ')}\n\n`;
      }
    }
  }

  const typesList = types.length > 0 ? types.join('|') : 'thruster|robonaut|refinery|reactor|radiator|generator|crew|freighter|bernal|colonist|gw-thruster';

  return `You are identifying cards from "High Frontier 4 All" board game. You MUST return card names EXACTLY as they appear in the VALID CARD NAMES list below. DO NOT invent, modify, or guess names that are not in the list.

CRITICAL: The card name is printed at the BOTTOM of each card in small text. Read this text carefully and match it to a name from the valid list.

Return JSON format:
{
  "gridRows": N,
  "gridCols": M,
  "cards": [
    {
      "card_type": "${typesList}",
      "card_name": "EXACT name from valid list",
      "side": "white|black|blue",
      "confidence": 0.0-1.0,
      "bbox": [x1, y1, x2, y2]
    }
  ]
}
${validNamesSection}
=== IDENTIFICATION RULES ===

1. CARD TYPE: Look at the colored banner at TOP of card
   - Orange = thruster
   - Red/salmon = generator
   - Dark purple = reactor
   - Light blue = radiator
   - Brown/tan = refinery
   - Magenta/pink = robonaut

2. CARD NAME: Read the text at the BOTTOM of the card carefully. Find the EXACT match in the valid names list for that card type. The name is usually 2-4 words.

3. NEVER INVENT NAMES: You MUST return a name exactly as it appears in the valid list. Do not:
   - Add words (e.g., "Mk II", "Advanced")
   - Change spelling
   - Combine words from different cards
   - Guess names that sound similar
   If unsure, return your best match from the list with lower confidence.

4. bbox: normalized [0-1] coordinates for each card's position

Return ONLY valid JSON, no markdown.`;
}

/**
 * Build a simple segmentation prompt - just detect card locations, no identification
 */
function buildSegmentPrompt(): string {
  return `You are analyzing an image to find playing cards from a board game.

Your task is ONLY to locate the cards - do NOT try to read or identify them.

Return JSON:
{
  "gridRows": N,
  "gridCols": M,
  "cards": [
    {
      "bbox": [x1, y1, x2, y2],
      "position": "row,col"
    }
  ]
}

Rules:
- Count how many cards are visible
- Determine the grid arrangement (e.g., 3x3, 2x2, 1x1)
- For each card, return its bounding box as normalized [0-1] coordinates
- position: "0,0" is top-left, "0,1" is top-middle, etc.
- Cards are rectangular with colored banners at top
- Return cards in reading order (left-to-right, top-to-bottom)
- Return ONLY valid JSON, no markdown`;
}

const MODEL_MAP: Record<string, string> = {
  // GPT-4.1 family - RECOMMENDED (best accuracy + speed)
  'gpt41-mini': 'gpt-4.1-mini',
  'gpt41-nano': 'gpt-4.1-nano',
  'gpt4o-mini': 'gpt-4o-mini',
  // GPT-5 family (slower due to reasoning tokens)
  'gpt5-nano': 'gpt-5-nano',
  'gpt5-mini': 'gpt-5-mini',
  'gpt5': 'gpt-5',
  // Default aliases → GPT-4.1-mini
  nano: 'gpt-4.1-mini',
  mini: 'gpt-4.1-mini',
  fast: 'gpt-4.1-mini',
  accurate: 'gpt-4.1-mini',
};

// Compute SHA256 hash
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compute auth token from invite code + device ID
async function computeToken(inviteCode: string, deviceId: string, salt: string): Promise<string> {
  return sha256(inviteCode + deviceId + salt);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startTime = Date.now();

    // CORS handling
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',');
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o.trim()));

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (isAllowed) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Parse URL path
    const url = new URL(request.url);

    // Health check endpoint (GET allowed, no auth)
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        model: env.DEFAULT_MODEL,
        auth: 'invite-code-v1'
      }, 200, corsHeaders);
    }

    // List available models (GET allowed, no auth)
    if (url.pathname === '/models') {
      const modelsResponse = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      });
      const modelsData = await modelsResponse.json() as { data: Array<{ id: string }> };
      const gptModels = modelsData.data
        ?.filter(m => m.id.includes('gpt'))
        .map(m => m.id)
        .sort() || [];
      return jsonResponse({ models: gptModels, count: gptModels.length }, 200, corsHeaders);
    }

    // Registration endpoint (POST, no auth required)
    if (url.pathname === '/register') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
      }

      try {
        const body = await request.json() as RegisterRequest;

        if (!body.inviteCode || !body.deviceId) {
          return jsonResponse({
            error: 'Missing required fields: inviteCode, deviceId'
          }, 400, corsHeaders);
        }

        // Look up invite code
        const inviteKey = `INVITE:${body.inviteCode.toUpperCase()}`;
        const inviteDataRaw = await env.HF4A_AUTH.get(inviteKey);

        if (!inviteDataRaw) {
          return jsonResponse({
            error: 'Invalid invite code'
          }, 401, corsHeaders);
        }

        const inviteData: InviteData = JSON.parse(inviteDataRaw);

        // Check device limit
        if (inviteData.deviceCount >= inviteData.maxDevices) {
          return jsonResponse({
            error: 'Invite code device limit reached',
            maxDevices: inviteData.maxDevices
          }, 403, corsHeaders);
        }

        // Compute token
        const token = await computeToken(body.inviteCode.toUpperCase(), body.deviceId, env.AUTH_SALT);

        // Check if this device is already registered
        const existingToken = await env.HF4A_AUTH.get(`TOKEN:${token}`);
        if (existingToken) {
          // Already registered, just return success
          return jsonResponse({
            success: true,
            message: 'Device already registered'
          }, 200, corsHeaders);
        }

        // Store token
        const tokenData: TokenData = {
          inviteCode: body.inviteCode.toUpperCase(),
          deviceId: body.deviceId,
          createdAt: Date.now()
        };
        await env.HF4A_AUTH.put(`TOKEN:${token}`, JSON.stringify(tokenData));

        // Increment device count
        inviteData.deviceCount = (inviteData.deviceCount || 0) + 1;
        await env.HF4A_AUTH.put(inviteKey, JSON.stringify(inviteData));

        return jsonResponse({
          success: true,
          message: 'Device registered successfully'
        }, 200, corsHeaders);

      } catch (err) {
        console.error('Registration error:', err);
        return jsonResponse({
          error: err instanceof Error ? err.message : 'Registration failed'
        }, 500, corsHeaders);
      }
    }

    // All other endpoints require POST
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    // Main scan endpoint - requires auth
    if (url.pathname === '/scan' || url.pathname === '/api/scan') {
      // Validate auth token
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({
          error: 'Missing or invalid Authorization header. Use Bearer token.'
        }, 401, corsHeaders);
      }

      const token = authHeader.replace('Bearer ', '');
      const tokenData = await env.HF4A_AUTH.get(`TOKEN:${token}`);

      if (!tokenData) {
        return jsonResponse({
          error: 'Invalid or expired token. Please register your device.'
        }, 401, corsHeaders);
      }

      // Token valid, proceed with scan
      try {
        const body = await request.json() as ScanRequest;

        if (!body.image) {
          return jsonResponse({ error: 'Missing required field: image' }, 400, corsHeaders);
        }

        // Select model
        const modelKey = body.model || 'nano';
        const model = MODEL_MAP[modelKey] || env.DEFAULT_MODEL;

        // Determine if GPT-4.x or GPT-5 (different API params)
        const isGpt4 = model.startsWith('gpt-4');

        // Build system prompt with dynamic card names
        const systemPrompt = await buildSystemPrompt();

        // Build request body based on model family
        const requestBody: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: body.image.startsWith('data:')
                      ? body.image
                      : `data:image/jpeg;base64,${body.image}`,
                  },
                },
                {
                  type: 'text',
                  text: 'Identify the High Frontier 4 All card(s) in this image.',
                },
              ],
            },
          ],
        };

        if (isGpt4) {
          // GPT-4.x uses max_tokens and supports temperature
          requestBody.max_tokens = 2000;
          requestBody.temperature = 0.1;
        } else {
          // GPT-5 uses max_completion_tokens, no custom temperature
          requestBody.max_completion_tokens = 4000;
        }

        // Call OpenAI Vision API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error('OpenAI API error:', openaiResponse.status, errorText);
          let errorDetail = `OpenAI API error: ${openaiResponse.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorDetail = errorJson.error?.message || errorDetail;
          } catch { /* ignore parse errors */ }
          return jsonResponse({
            success: false,
            cards: [],
            model_used: model,
            latency_ms: Date.now() - startTime,
            error: errorDetail,
          } as ScanResponse, 502, corsHeaders);
        }

        const openaiResult = await openaiResponse.json() as {
          choices: Array<{ message: { content: string | null } }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        // Parse the response - GPT-5 may return null content with reasoning tokens
        const content = openaiResult.choices[0]?.message?.content;
        if (!content) {
          return jsonResponse({
            success: false,
            cards: [],
            model_used: model,
            tokens_used: openaiResult.usage ? {
              input: openaiResult.usage.prompt_tokens,
              output: openaiResult.usage.completion_tokens,
            } : undefined,
            latency_ms: Date.now() - startTime,
            error: `No content in response. Raw: ${JSON.stringify(openaiResult.choices[0]).slice(0, 300)}`,
          } as ScanResponse, 200, corsHeaders);
        }
        let parsed: { cards?: CardResult[]; gridRows?: number; gridCols?: number; error?: string };

        try {
          // Handle potential markdown code blocks
          const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
          parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error('Failed to parse OpenAI response:', content);
          parsed = { cards: [], error: `Failed to parse: ${content.slice(0, 200)}` };
        }

        const response: ScanResponse = {
          success: !parsed.error && (parsed.cards?.length ?? 0) > 0,
          cards: parsed.cards || [],
          gridRows: parsed.gridRows,
          gridCols: parsed.gridCols,
          model_used: model,
          tokens_used: openaiResult.usage ? {
            input: openaiResult.usage.prompt_tokens,
            output: openaiResult.usage.completion_tokens,
          } : undefined,
          latency_ms: Date.now() - startTime,
          error: parsed.error,
        };

        return jsonResponse(response, 200, corsHeaders);

      } catch (err) {
        console.error('Worker error:', err);
        return jsonResponse({
          success: false,
          cards: [],
          model_used: env.DEFAULT_MODEL,
          latency_ms: Date.now() - startTime,
          error: err instanceof Error ? err.message : 'Unknown error',
        } as ScanResponse, 500, corsHeaders);
      }
    }

    // Segment endpoint - just detect card locations, no identification
    if (url.pathname === '/segment') {
      // Validate auth token
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({
          error: 'Missing or invalid Authorization header. Use Bearer token.'
        }, 401, corsHeaders);
      }

      const token = authHeader.replace('Bearer ', '');
      const tokenData = await env.HF4A_AUTH.get(`TOKEN:${token}`);

      if (!tokenData) {
        return jsonResponse({
          error: 'Invalid or expired token. Please register your device.'
        }, 401, corsHeaders);
      }

      try {
        const body = await request.json() as ScanRequest;

        if (!body.image) {
          return jsonResponse({ error: 'Missing required field: image' }, 400, corsHeaders);
        }

        const model = env.DEFAULT_MODEL;
        const isGpt4 = model.startsWith('gpt-4');

        // Use simple segmentation prompt
        const systemPrompt = buildSegmentPrompt();

        const requestBody: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: body.image.startsWith('data:')
                      ? body.image
                      : `data:image/jpeg;base64,${body.image}`,
                  },
                },
                {
                  type: 'text',
                  text: 'Find all the playing cards in this image and return their locations.',
                },
              ],
            },
          ],
        };

        if (isGpt4) {
          requestBody.max_tokens = 1000;
          requestBody.temperature = 0.1;
        } else {
          requestBody.max_completion_tokens = 2000;
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          return jsonResponse({
            success: false,
            error: `OpenAI API error: ${openaiResponse.status}`,
            latency_ms: Date.now() - startTime,
          }, 502, corsHeaders);
        }

        const openaiResult = await openaiResponse.json() as {
          choices: Array<{ message: { content: string | null } }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        const content = openaiResult.choices[0]?.message?.content;
        if (!content) {
          return jsonResponse({
            success: false,
            error: 'No content in response',
            latency_ms: Date.now() - startTime,
          }, 200, corsHeaders);
        }

        let parsed: { cards?: Array<{ bbox: number[]; position: string }>; gridRows?: number; gridCols?: number; error?: string };

        try {
          const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
          parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
          parsed = { error: `Failed to parse: ${content.slice(0, 200)}` };
        }

        return jsonResponse({
          success: !parsed.error && (parsed.cards?.length ?? 0) > 0,
          cards: parsed.cards || [],
          gridRows: parsed.gridRows,
          gridCols: parsed.gridCols,
          model_used: model,
          tokens_used: openaiResult.usage ? {
            input: openaiResult.usage.prompt_tokens,
            output: openaiResult.usage.completion_tokens,
          } : undefined,
          latency_ms: Date.now() - startTime,
          error: parsed.error,
        }, 200, corsHeaders);

      } catch (err) {
        return jsonResponse({
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          latency_ms: Date.now() - startTime,
        }, 500, corsHeaders);
      }
    }

    return jsonResponse({ error: 'Not found. Use POST /register, /scan, or /segment' }, 404, corsHeaders);
  },
};

function jsonResponse(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
