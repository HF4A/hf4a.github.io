/**
 * HF4A Card Scanner - Cloudflare Worker
 *
 * Accepts card images and identifies them using OpenAI Vision API (GPT-4.1-mini)
 * Authentication via invite code + device ID scheme
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

const SYSTEM_PROMPT = `You are an expert at identifying cards from the board game "High Frontier 4 All" by Sierra Madre Games.

When shown an image of a card (or multiple cards), identify each card and return JSON:

{
  "gridRows": 3,
  "gridCols": 3,
  "cards": [
    {
      "card_type": "crew|thruster|robonaut|refinery|reactor|radiator|generator|freighter|bernal|colonist|patent|event|factory|support",
      "card_name": "exact name as printed on the card",
      "side": "white|black|blue|gold|purple",
      "confidence": 0.0-1.0,
      "ocr_text": "key text visible on the card",
      "bbox": [x1, y1, x2, y2]
    }
  ]
}

Rules:
- gridRows/gridCols: the arrangement of cards in the image (e.g., 3x3 grid = 3 rows, 3 cols). Set to 1x1 for single card.
- card_type must be one of the listed types (appears in colored banner at top)
- card_name is the unique name printed at the BOTTOM of the card (NOT the type). Examples: "Solar Moth", "Ericsson Engine", "Penning Trap"
- side refers to the card's BACK color (white, black, blue, gold, or purple). The colored banner at top indicates card_type, not side. Most tech cards are white-backed.
- confidence: 1.0 = certain, 0.5 = unsure, below 0.3 = guess
- bbox: normalized coordinates [0-1] for top-left (x1,y1) and bottom-right (x2,y2) of each card in the image
- If no cards visible or not HF4A cards, return {"cards": [], "error": "no cards detected"}
- Return ONLY valid JSON, no markdown or explanation`;

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

        // Build request body based on model family
        const requestBody: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
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
        let parsed: { cards?: CardResult[]; error?: string };

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

    return jsonResponse({ error: 'Not found. Use POST /register or POST /scan' }, 404, corsHeaders);
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
