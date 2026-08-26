/**
 * Global API Request Interceptor
 * 
 * Intercepts all outgoing HTTP requests targeting 'mybusinessaccountmanagement.googleapis.com'
 * (and other Google Business APIs).
 * 
 * Capabilities:
 * 1. Identifies '429 Too Many Requests' status codes.
 * 2. Captures 'Retry-After' headers (numeric seconds or HTTP-Date).
 * 3. Calculates and stores the 'until' timestamp in a persistent disk + memory cache.
 * 4. Ensures subsequent requests to this service are blocked locally (0 network calls)
 *    until the cooldown period expires.
 */

import { 
  getServiceCooldown, 
  setServiceCooldown, 
  setUserApiAccessState,
  ServiceCooldownEntry 
} from './rateLimitCache.ts';

const TRACKED_SERVICES = [
  'mybusinessaccountmanagement.googleapis.com',
  'mybusinessbusinessinformation.googleapis.com',
  'mybusiness.googleapis.com',
  'businessprofileperformance.googleapis.com'
];

/**
 * Extracts the target service hostname from a URL, Request, or string.
 */
export function extractTargetService(input: string | URL | Request): string {
  try {
    let urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (typeof input === 'object' && input !== null && 'url' in input) {
      urlStr = (input as Request).url;
    }

    if (!urlStr) return 'unknown';

    try {
      const parsed = new URL(urlStr);
      return parsed.hostname;
    } catch {
      for (const service of TRACKED_SERVICES) {
        if (urlStr.includes(service)) {
          return service;
        }
      }
      return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

/**
 * Parses the 'Retry-After' header value into integer seconds.
 * Supports:
 * - Delta-seconds (e.g. '120')
 * - HTTP-Date (e.g. 'Wed, 21 Oct 2026 07:28:00 GMT')
 */
export function parseRetryAfterHeader(retryHeader: string | null | undefined, defaultSeconds = 60): number {
  if (!retryHeader) return defaultSeconds;

  const trimmed = retryHeader.trim();
  const numeric = parseInt(trimmed, 10);
  if (!isNaN(numeric) && numeric > 0) {
    return numeric;
  }

  const httpDate = new Date(trimmed).getTime();
  if (!isNaN(httpDate) && httpDate > Date.now()) {
    return Math.ceil((httpDate - Date.now()) / 1000);
  }

  return defaultSeconds;
}

/**
 * Custom Error class for locally blocked 429 requests.
 */
export class RateLimitBlockedError extends Error {
  public readonly status = 429;
  public readonly code = 'RATE_LIMIT_BLOCKED_LOCALLY';
  public readonly blockedLocally = true;
  public readonly service: string;
  public readonly until: number;
  public readonly retryAfter: number;
  public readonly quotaNotGranted: boolean;

  constructor(service: string, until: number, remainingSeconds: number, quotaNotGranted = false) {
    const msg = quotaNotGranted
      ? `[RateLimitBlocked] Requests to '${service}' blocked locally. Google Business Profile API quota is not available.`
      : `[RateLimitBlocked] Requests to '${service}' blocked locally until ${new Date(until).toISOString()} (${remainingSeconds}s remaining).`;
    super(msg);
    this.name = 'RateLimitBlockedError';
    this.service = service;
    this.until = until;
    this.retryAfter = remainingSeconds;
    this.quotaNotGranted = quotaNotGranted;
  }
}

/**
 * Executes a fetch request with 429 interception and persistent cooldown enforcement.
 */
export async function interceptedFetch(
  input: string | URL | Request,
  init?: RequestInit,
  userId?: number
): Promise<Response> {
  const service = extractTargetService(input);
  const isTracked = TRACKED_SERVICES.includes(service);

  // 1. PRE-REQUEST: Check if service is in cooldown
  if (isTracked) {
    const cooldown = getServiceCooldown(service);
    if (cooldown.isBlocked) {
      console.warn(
        `[GLOBAL INTERCEPTOR: BLOCKED LOCALLY] Request to '${service}' blocked until ${new Date(cooldown.until).toISOString()} (${cooldown.remainingSeconds}s remaining). 0 network calls dispatched.`
      );
      throw new RateLimitBlockedError(service, cooldown.until, cooldown.remainingSeconds, cooldown.quotaNotGranted);
    }
  }

  // 2. DISPATCH REQUEST
  const response = await fetch(input, init);

  // 3. POST-REQUEST: Intercept 429 Too Many Requests
  if (response.status === 429 && isTracked) {
    const retryHeader = response.headers.get('retry-after');
    const retryAfterSeconds = parseRetryAfterHeader(retryHeader, 60);

    let isQuotaNotGranted = false;
    let errMessage = 'Too Many Requests';

    try {
      const cloned = response.clone();
      const errorData = await cloned.json();
      errMessage = errorData.error?.message || errorData.message || errMessage;
      
      const errorDetails = errorData.error?.details || [];
      for (const detail of errorDetails) {
        if (detail['@type']?.includes('ErrorInfo')) {
          if (detail.metadata?.quota_limit_value === '0' || detail.reason === 'RATE_LIMIT_EXCEEDED') {
            isQuotaNotGranted = true;
          }
        }
      }
      if (errMessage.includes('quota metric') && errMessage.includes('Requests per minute')) {
        isQuotaNotGranted = true;
      }
    } catch {
      // Body may not be JSON
    }

    // Store 'until' timestamp in persistent disk + memory cache
    const saved = setServiceCooldown(service, retryAfterSeconds, isQuotaNotGranted, errMessage);

    if (userId) {
      setUserApiAccessState(userId, 'pending', isQuotaNotGranted ? 'quota_not_granted' : 'rate_limited');
    }

    console.warn(
      `[GLOBAL INTERCEPTOR: 429 CAPTURED] Service: ${service} | Retry-After: ${retryAfterSeconds}s | Blocked until: ${new Date(saved.until).toISOString()} | QuotaNotGranted: ${isQuotaNotGranted}`
    );
  }

  return response;
}

let isInterceptorInstalled = false;

/**
 * Installs the global fetch interceptor at process level.
 * Monkey-patches globalThis.fetch to automatically protect all outbound requests
 * against 429 rate limit spam and enforce local blocking.
 */
export function installGlobalApiInterceptor(): void {
  if (isInterceptorInstalled) return;

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function (input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const service = extractTargetService(input);
    const isTracked = TRACKED_SERVICES.includes(service);

    if (isTracked) {
      const cooldown = getServiceCooldown(service);
      if (cooldown.isBlocked) {
        console.warn(
          `[GLOBAL FETCH INTERCEPTOR] Locally blocking outbound request to '${service}'. Cooldown active until ${new Date(cooldown.until).toISOString()} (${cooldown.remainingSeconds}s remaining).`
        );
        
        // Return synthetic 429 response or throw depending on standard fetch semantics
        const headers = new Headers({
          'Retry-After': cooldown.remainingSeconds.toString(),
          'Content-Type': 'application/json',
          'X-Blocked-Locally': 'true',
        });
        
        const body = JSON.stringify({
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: cooldown.quotaNotGranted 
              ? 'Google Business Profile API quota is not available for this project.'
              : `Service rate limit reached. Blocked locally for ${cooldown.remainingSeconds}s.`,
            blockedLocally: true,
            retryAfter: cooldown.remainingSeconds,
            until: cooldown.until
          }
        });

        return new Response(body, {
          status: 429,
          statusText: 'Too Many Requests (Blocked Locally by Interceptor)',
          headers
        });
      }
    }

    const response = await originalFetch(input, init);

    if (response.status === 429 && isTracked) {
      const retryHeader = response.headers.get('retry-after');
      const retryAfterSeconds = parseRetryAfterHeader(retryHeader, 60);

      let isQuotaNotGranted = false;
      let errMessage = 'Too Many Requests';

      try {
        const cloned = response.clone();
        const errorData = await cloned.json();
        errMessage = errorData.error?.message || errorData.message || errMessage;
        const errorDetails = errorData.error?.details || [];
        for (const detail of errorDetails) {
          if (detail['@type']?.includes('ErrorInfo')) {
            if (detail.metadata?.quota_limit_value === '0' || detail.reason === 'RATE_LIMIT_EXCEEDED') {
              isQuotaNotGranted = true;
            }
          }
        }
        if (errMessage.includes('quota metric') && errMessage.includes('Requests per minute')) {
          isQuotaNotGranted = true;
        }
      } catch {
        // Body may not be JSON
      }

      setServiceCooldown(service, retryAfterSeconds, isQuotaNotGranted, errMessage);
    }

    return response;
  };

  isInterceptorInstalled = true;
  console.log('[GLOBAL API INTERCEPTOR] Installed successfully. Monitoring services:', TRACKED_SERVICES.join(', '));
}
