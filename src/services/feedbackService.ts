/**
 * Feedback Service - API client for feedback/diagnostics submission
 *
 * Endpoints:
 * - POST /feedback/report - Submit correction feedback
 * - POST /feedback/diagnostics - Upload diagnostics ZIP
 */

import { authService } from './authService';
import { APP_VERSION, BUILD_HASH } from '../version';

export interface FeedbackReport {
  type: 'correction_report';
  scanId: string;
  cardIndex: number;
  apiReturnedType?: string;
  extractedText?: string;
  computedHash?: string;
  originalCardId?: string;
  originalConfidence?: number;
  correctedCardId?: string;
  topMatches?: Array<{ cardId: string; distance: number }>;
  userComment?: string;
  croppedImage?: string;
  metadata: {
    appVersion: string;
    buildHash?: string;
    platform?: string;
    userAgent?: string;
  };
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId?: string;
  message?: string;
  error?: string;
  size?: number;
}

/**
 * Submit a correction feedback report
 */
export async function submitFeedbackReport(
  report: Omit<FeedbackReport, 'metadata'>
): Promise<FeedbackResponse> {
  if (!authService.hasCredentials()) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const authHeaders = await authService.getAuthHeaders();

    const fullReport: FeedbackReport = {
      ...report,
      metadata: {
        appVersion: APP_VERSION,
        buildHash: BUILD_HASH,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      },
    };

    const response = await fetch(`${authService.API_BASE}/feedback/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(fullReport),
    });

    const data = await response.json();
    return data as FeedbackResponse;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Upload diagnostics ZIP file with optional comment
 */
export async function uploadDiagnostics(
  zipBlob: Blob,
  comment?: string
): Promise<FeedbackResponse> {
  if (!authService.hasCredentials()) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const authHeaders = await authService.getAuthHeaders();

    const formData = new FormData();
    formData.append('file', zipBlob, 'diagnostics.zip');
    if (comment) {
      formData.append('comment', comment);
    }

    const response = await fetch(`${authService.API_BASE}/feedback/diagnostics`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    const data = await response.json();
    return data as FeedbackResponse;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Check if feedback service is available (authenticated + online)
 */
export function isAvailable(): boolean {
  return authService.hasCredentials() && navigator.onLine;
}

export const feedbackService = {
  submitFeedbackReport,
  uploadDiagnostics,
  isAvailable,
};
