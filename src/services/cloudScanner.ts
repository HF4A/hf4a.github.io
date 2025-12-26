/**
 * Cloud Scanner service for HF4A Card Scanner API
 *
 * Sends images to Cloudflare Worker for card identification
 * using OpenAI Vision API (GPT-4.1-mini).
 */

import { authService } from './authService';

export interface CardResult {
  card_type: string;
  card_name: string;
  side: string;
  confidence: number;
  ocr_text?: string;
  bbox?: [number, number, number, number];
}

export interface ScanResponse {
  success: boolean;
  cards: CardResult[];
  model_used: string;
  tokens_used?: { input: number; output: number };
  latency_ms: number;
  error?: string;
}

export interface ScanOptions {
  model?: 'nano' | 'mini' | 'fast' | 'accurate';
}

/**
 * Scan a card image using the cloud API
 * @param imageData - Base64-encoded image or data URL
 * @param options - Optional scan configuration
 * @returns ScanResponse with identified cards
 */
export async function scanCardImage(
  imageData: string,
  options: ScanOptions = {}
): Promise<ScanResponse> {
  // Check if we have credentials
  if (!authService.hasCredentials()) {
    return {
      success: false,
      cards: [],
      model_used: 'none',
      latency_ms: 0,
      error: 'Not authenticated. Please enter an invite code.',
    };
  }

  const startTime = Date.now();

  try {
    const authHeaders = await authService.getAuthHeaders();

    const response = await fetch(`${authService.API_BASE}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        image: imageData,
        model: options.model || 'nano',
      }),
    });

    // Handle auth errors
    if (response.status === 401) {
      // Token may be invalid or expired
      authService.clearCredentials();
      return {
        success: false,
        cards: [],
        model_used: 'none',
        latency_ms: Date.now() - startTime,
        error: 'Authentication expired. Please re-enter your invite code.',
      };
    }

    const data: ScanResponse = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      cards: [],
      model_used: 'none',
      latency_ms: Date.now() - startTime,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Scan from a canvas element
 * @param canvas - HTMLCanvasElement with the image
 * @param options - Optional scan configuration
 * @returns ScanResponse with identified cards
 */
export async function scanFromCanvas(
  canvas: HTMLCanvasElement,
  options: ScanOptions = {}
): Promise<ScanResponse> {
  // Convert canvas to JPEG data URL (smaller than PNG)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return scanCardImage(dataUrl, options);
}

/**
 * Check if the cloud scanner is available (has valid credentials)
 */
export function isAvailable(): boolean {
  return authService.hasCredentials();
}

/**
 * Check network connectivity to the API
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${authService.API_BASE}/health`);
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export const cloudScanner = {
  scanCardImage,
  scanFromCanvas,
  isAvailable,
  checkHealth,
};
