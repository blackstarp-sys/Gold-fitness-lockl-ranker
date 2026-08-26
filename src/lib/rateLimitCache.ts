/**
 * Persistent Rate Limit Cache
 * Stores service cooldowns with 'until' timestamps in a persistent file and memory cache.
 * Ensures blocked services (e.g. mybusinessaccountmanagement.googleapis.com) are rejected locally without outbound network calls.
 */

import fs from 'fs';
import path from 'path';

export interface ServiceCooldownEntry {
  service: string;
  until: number; // Unix epoch ms
  retryAfterSeconds: number;
  quotaNotGranted: boolean;
  reason?: string;
  updatedAt: string;
}

export type GoogleApiAccessState = 'ready' | 'pending' | 'unknown' | 'scope_missing' | 'access_denied' | 'reauth_required';

const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'service_rate_limits.json');
const API_ACCESS_STATE_FILE = path.join(CACHE_DIR, 'api_access_state.json');

// In-Memory map synced with persistent file
const memoryCache = new Map<string, ServiceCooldownEntry>();
const userApiAccessState = new Map<number, { state: GoogleApiAccessState; reason?: string; updatedAt: string }>();

// Load API access state from disk
function loadApiAccessStateFromDisk(): void {
  try {
    if (fs.existsSync(API_ACCESS_STATE_FILE)) {
      const raw = fs.readFileSync(API_ACCESS_STATE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        for (const [key, val] of Object.entries(data)) {
          const numKey = parseInt(key, 10);
          if (!isNaN(numKey) && val && typeof val === 'object') {
            userApiAccessState.set(numKey, val as any);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[API ACCESS CACHE] Error loading state from disk:', err instanceof Error ? err.message : err);
  }
}

// Persist API access state to disk
function saveApiAccessStateToDisk(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const obj: Record<string, any> = {};
    for (const [key, val] of userApiAccessState.entries()) {
      obj[key.toString()] = val;
    }
    fs.writeFileSync(API_ACCESS_STATE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[API ACCESS CACHE] Error saving state to disk:', err instanceof Error ? err.message : err);
  }
}

export function getUserApiAccessState(userId: number): { state: GoogleApiAccessState; reason?: string; updatedAt?: string } | null {
  return userApiAccessState.get(userId) || null;
}

export function setUserApiAccessState(userId: number, state: GoogleApiAccessState, reason?: string): void {
  userApiAccessState.set(userId, {
    state,
    reason,
    updatedAt: new Date().toISOString(),
  });
  saveApiAccessStateToDisk();
}

// Initialize persistent cache from disk
function loadCacheFromDisk(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        const now = Date.now();
        for (const [key, val] of Object.entries(data)) {
          const entry = val as ServiceCooldownEntry;
          // Only load unexpired cooldowns or quotaNotGranted flags
          if (entry && (entry.until > now || entry.quotaNotGranted)) {
            memoryCache.set(key, entry);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[RATE LIMIT CACHE] Error loading persistent cache from disk:', err instanceof Error ? err.message : err);
  }
}

// Persist in-memory cache to disk
function saveCacheToDisk(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const obj: Record<string, ServiceCooldownEntry> = {};
    for (const [key, val] of memoryCache.entries()) {
      obj[key] = val;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[RATE LIMIT CACHE] Error saving persistent cache to disk:', err instanceof Error ? err.message : err);
  }
}

// Initial load
loadCacheFromDisk();
loadApiAccessStateFromDisk();

/**
 * Checks if a specific service is currently in a 429 cooldown period.
 */
export function getServiceCooldown(service: string): {
  isBlocked: boolean;
  remainingSeconds: number;
  until: number;
  quotaNotGranted: boolean;
  retryAfterSeconds: number;
} {
  const entry = memoryCache.get(service);
  if (!entry) {
    return {
      isBlocked: false,
      remainingSeconds: 0,
      until: 0,
      quotaNotGranted: false,
      retryAfterSeconds: 0,
    };
  }

  const now = Date.now();
  if (entry.until > now) {
    const remainingSeconds = Math.ceil((entry.until - now) / 1000);
    return {
      isBlocked: true,
      remainingSeconds,
      until: entry.until,
      quotaNotGranted: entry.quotaNotGranted,
      retryAfterSeconds: entry.retryAfterSeconds,
    };
  }

  // Cooldown expired, but retain quotaNotGranted diagnostic flag if recorded
  return {
    isBlocked: false,
    remainingSeconds: 0,
    until: entry.until,
    quotaNotGranted: entry.quotaNotGranted,
    retryAfterSeconds: 0,
  };
}

/**
 * Sets a cooldown for a service in persistent cache.
 */
export function setServiceCooldown(
  service: string,
  retryAfterSeconds = 60,
  quotaNotGranted = false,
  reason?: string
): ServiceCooldownEntry {
  const safeRetryAfter = Math.max(1, retryAfterSeconds);
  const until = Date.now() + safeRetryAfter * 1000;
  const entry: ServiceCooldownEntry = {
    service,
    until,
    retryAfterSeconds: safeRetryAfter,
    quotaNotGranted,
    reason,
    updatedAt: new Date().toISOString(),
  };

  memoryCache.set(service, entry);
  saveCacheToDisk();

  console.warn(
    `[SERVICE RATE LIMIT COOLDOWN] Service '${service}' blocked until ${new Date(until).toISOString()} (${safeRetryAfter}s). QuotaNotGranted: ${quotaNotGranted}`
  );

  return entry;
}

/**
 * Clears the cooldown for a service.
 */
export function clearServiceCooldown(service: string): void {
  if (memoryCache.has(service)) {
    memoryCache.delete(service);
    saveCacheToDisk();
  }
}

/**
 * Returns all active service cooldowns.
 */
export function getAllServiceCooldowns(): Record<string, ServiceCooldownEntry> {
  const result: Record<string, ServiceCooldownEntry> = {};
  const now = Date.now();
  for (const [key, val] of memoryCache.entries()) {
    if (val.until > now || val.quotaNotGranted) {
      result[key] = val;
    }
  }
  return result;
}
