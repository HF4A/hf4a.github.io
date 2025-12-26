/**
 * Authentication service for HF4A Card Scanner API
 *
 * Uses invite code + device ID to generate auth tokens.
 * Tokens are computed on-the-fly, never stored directly.
 */

const API_BASE = 'https://hf4a-card-scanner.github-f2b.workers.dev';
const AUTH_SALT = 'hf4a-salt-v1';
const STORAGE_KEYS = {
  inviteCode: 'hf4a-invite-code',
  deviceId: 'hf4a-device-id',
  registered: 'hf4a-registered',
} as const;

// Compute SHA256 hash
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get or create device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEYS.deviceId);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
  }
  return deviceId;
}

// Get stored invite code
function getInviteCode(): string | null {
  return localStorage.getItem(STORAGE_KEYS.inviteCode);
}

// Check if device is registered
function isRegistered(): boolean {
  return localStorage.getItem(STORAGE_KEYS.registered) === 'true';
}

// Compute auth token from stored credentials
async function computeToken(): Promise<string | null> {
  const inviteCode = getInviteCode();
  const deviceId = getDeviceId();

  if (!inviteCode) {
    return null;
  }

  return sha256(inviteCode.toUpperCase() + deviceId + AUTH_SALT);
}

// Register device with the API
interface RegisterResult {
  success: boolean;
  error?: string;
}

async function register(inviteCode: string): Promise<RegisterResult> {
  const deviceId = getDeviceId();

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inviteCode: inviteCode.toUpperCase(),
        deviceId,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Store invite code and mark as registered
      localStorage.setItem(STORAGE_KEYS.inviteCode, inviteCode.toUpperCase());
      localStorage.setItem(STORAGE_KEYS.registered, 'true');
      return { success: true };
    }

    return {
      success: false,
      error: data.error || 'Registration failed',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

// Clear stored credentials (logout)
function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEYS.inviteCode);
  localStorage.removeItem(STORAGE_KEYS.registered);
  // Keep deviceId - it's tied to this browser
}

// Check if we have valid credentials (may not be registered yet)
function hasCredentials(): boolean {
  return !!getInviteCode() && isRegistered();
}

// Get auth headers for API calls
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await computeToken();
  if (!token) {
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`,
  };
}

export const authService = {
  getDeviceId,
  getInviteCode,
  isRegistered,
  hasCredentials,
  register,
  clearCredentials,
  computeToken,
  getAuthHeaders,
  API_BASE,
};
