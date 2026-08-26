/**
 * Google Business Profile (GBP) API Service
 * Handles Accounts, Locations, Reviews, Replies, Posts, and Performance metrics
 * With Persistent Rate-Limit Cooldown Cache, Global API Request Interception, and Quota Diagnostics
 */

import { db } from '../db/index.ts';
import { googleBusinessAccounts, users, businessLocations } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';
import { getServiceCooldown, setServiceCooldown, setUserApiAccessState } from './rateLimitCache.ts';

const GBP_ACCOUNT_MANAGEMENT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const GBP_BUSINESS_INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_API = 'https://mybusiness.googleapis.com/v4';

// 24-Hour Cache TTL for Google Account Discovery (Accounts rarely change)
export const ACCOUNT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Track if Google Quota is diagnosed as not granted / 0 quota
let quotaNotGranted = false;

// In-Memory Request Deduplication
const accountRequests = new Map<number, Promise<{ accounts: BusinessAccount[]; fromCache: boolean; rateLimited?: boolean }>>();

export interface BusinessAccount {
  name: string; // e.g., 'accounts/123456789'
  accountName: string; // display name e.g., 'My Business Group'
  type: string;
  lastSyncedAt?: string | Date;
}

export interface BusinessLocation {
  name: string; // e.g., 'locations/987654321' or 'accounts/xxx/locations/yyy'
  title: string;
  storeCode?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  phoneNumbers?: {
    primaryPhone?: string;
  };
  categories?: {
    primaryCategory?: {
      displayName?: string;
    };
  };
  regularHours?: any;
  websiteUri?: string;
  profile?: {
    description?: string;
  };
  latlng?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface GoogleReview {
  reviewId: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
  };
  starRating: string; // 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'
  comment?: string;
  createTime: string;
  updateTime?: string;
  reviewReply?: {
    comment: string;
    updateTime?: string;
  };
}

/**
 * Extracts the service host from a URL (e.g., 'mybusinessaccountmanagement.googleapis.com')
 */
function extractServiceName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    if (url.includes('mybusinessaccountmanagement.googleapis.com')) {
      return 'mybusinessaccountmanagement.googleapis.com';
    }
    if (url.includes('mybusinessbusinessinformation.googleapis.com')) {
      return 'mybusinessbusinessinformation.googleapis.com';
    }
    if (url.includes('businessprofileperformance.googleapis.com')) {
      return 'businessprofileperformance.googleapis.com';
    }
    return 'mybusiness.googleapis.com';
  }
}

/**
 * Checks if an account or service is currently in a 429 rate-limit cooldown.
 */
export function isAccountInCooldown(userId?: number, service = 'mybusinessaccountmanagement.googleapis.com'): { 
  inCooldown: boolean; 
  remainingSeconds: number; 
  quotaNotGranted: boolean;
  until: number;
} {
  const status = getServiceCooldown(service);
  return {
    inCooldown: status.isBlocked,
    remainingSeconds: status.remainingSeconds,
    quotaNotGranted: status.quotaNotGranted || quotaNotGranted,
    until: status.until,
  };
}

/**
 * Global API Request Interceptor for Google Business Profile services.
 * - Identifies '429 Too Many Requests' from target services (e.g. mybusinessaccountmanagement.googleapis.com).
 * - Captures 'Retry-After' header and calculates until timestamp.
 * - Stores until timestamp in persistent cache.
 * - Locally blocks subsequent requests to the service until cooldown expires without network overhead.
 */
export async function gbpInterceptedFetch(
  url: string,
  options: RequestInit,
  context: string,
  userId?: number
): Promise<Response> {
  const serviceName = extractServiceName(url);

  // 1. PRE-REQUEST INTERCEPTION: Check persistent cache for active cooldown
  const cooldown = getServiceCooldown(serviceName);
  if (cooldown.isBlocked) {
    console.warn(
      `[GBP REQUEST BLOCKED LOCALLY] Service '${serviceName}' is cooling down. Blocked until ${new Date(cooldown.until).toISOString()} (${cooldown.remainingSeconds}s remaining). Context: ${context}`
    );

    const isQuotaNotGranted = cooldown.quotaNotGranted || quotaNotGranted;
    const err: any = new Error(
      isQuotaNotGranted
        ? 'Google Business Profile API quota is not currently available for this project. Review the API quota/access configuration in Google Cloud Console.'
        : `Google API rate limit reached. Please wait ${cooldown.remainingSeconds}s and try Sync again.`
    );
    err.status = 429;
    err.code = isQuotaNotGranted ? 'GOOGLE_API_QUOTA_NOT_GRANTED' : 'QUOTA_TEMPORARILY_EXCEEDED';
    err.retryAfter = cooldown.remainingSeconds;
    err.blockedLocally = true;
    err.service = serviceName;
    throw err;
  }

  // 2. EXECUTE REQUEST
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (networkError: any) {
    console.error(`[GBP NETWORK ERROR] (${context}) ${networkError.message}`);
    throw networkError;
  }

  // 3. POST-REQUEST INTERCEPTION: Handle 429 and error responses
  if (!response.ok) {
    await handleGbpError(response, context, userId, serviceName);
  }

  return response;
}

/**
 * Normalizes and categorizes Google Business Profile API errors.
 * Intercepts HTTP 429, extracts Retry-After headers, detects quota availability, and updates persistent cache.
 */
async function handleGbpError(
  response: Response, 
  context: string, 
  userId?: number,
  serviceName = 'mybusinessaccountmanagement.googleapis.com'
): Promise<never> {
  let errorData: any = {};
  try {
    errorData = await response.json();
  } catch {
    errorData = { message: response.statusText };
  }

  const errMessage = errorData.error?.message || errorData.message || response.statusText || 'Unknown GBP API error';
  const status = response.status;
  const errorDetails = errorData.error?.details || [];

  // Safe server-side log (no secrets/tokens)
  console.error(`[GOOGLE GBP API ERROR] (${context}) Status: ${status} | Service: ${serviceName} | Message: ${errMessage}`);

  const err: any = new Error(`GBP Error (${context}): ${errMessage}`);
  err.status = status;
  err.details = errorData;
  err.service = serviceName;

  if (status === 429) {
    // Determine retry delay from Retry-After header
    let retryAfterSeconds = 60;
    const retryHeader = response.headers.get('retry-after');
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterSeconds = parsed;
      } else {
        const httpDate = new Date(retryHeader).getTime();
        if (!isNaN(httpDate) && httpDate > Date.now()) {
          retryAfterSeconds = Math.ceil((httpDate - Date.now()) / 1000);
        }
      }
    }

    // Diagnostic on quota details
    let quotaMetric = 'Requests';
    let quotaLimit = 'Requests per minute';
    let detectedService = serviceName;
    let isQuotaNotGranted = false;

    for (const detail of errorDetails) {
      if (detail['@type']?.includes('QuotaFailure')) {
        const violation = detail.violations?.[0];
        if (violation) {
          quotaMetric = violation.subject || quotaMetric;
          quotaLimit = violation.description || quotaLimit;
        }
      } else if (detail['@type']?.includes('ErrorInfo')) {
        detectedService = detail.metadata?.service || detectedService;
        if (detail.metadata?.quota_limit_value === '0' || detail.reason === 'RATE_LIMIT_EXCEEDED') {
          isQuotaNotGranted = true;
          quotaNotGranted = true;
        }
      }
    }

    if (errMessage.includes('quota metric') && errMessage.includes('Requests per minute')) {
      isQuotaNotGranted = true;
      quotaNotGranted = true;
    }

    console.warn(
      `[GBP QUOTA DIAGNOSTIC] Service: ${detectedService} | Metric: ${quotaMetric} | Limit: ${quotaLimit} | Retry-After: ${retryAfterSeconds}s | QuotaNotGranted: ${isQuotaNotGranted}`
    );

    // Save cooldown to PERSISTENT CACHE
    setServiceCooldown(serviceName, retryAfterSeconds, isQuotaNotGranted, errMessage);
    if (detectedService !== serviceName) {
      setServiceCooldown(detectedService, retryAfterSeconds, isQuotaNotGranted, errMessage);
    }

    if (userId) {
      setUserApiAccessState(userId, 'pending', isQuotaNotGranted ? 'quota_not_granted' : 'rate_limited');
    }

    if (isQuotaNotGranted) {
      err.code = 'GOOGLE_API_QUOTA_NOT_GRANTED';
      err.message = 'Google Business Profile API quota is not currently available for this project. Review the API quota/access configuration in Google Cloud Console.';
    } else {
      err.code = 'QUOTA_TEMPORARILY_EXCEEDED';
      err.message = 'Google API rate limit reached. Please wait a short time and try Sync again.';
    }

    err.retryAfter = retryAfterSeconds;
  } else if (status === 401) {
    err.code = 'GOOGLE_REAUTH_REQUIRED';
    err.message = 'Google authorization has expired or is invalid. Please reconnect your Google account.';
  } else if (status === 403) {
    const lower = errMessage.toLowerCase();
    if (lower.includes('scope') || lower.includes('insufficient authentication scopes') || lower.includes('insufficient permissions')) {
      err.code = 'GOOGLE_SCOPE_MISSING';
      err.message = 'Missing required Google Business Profile permissions (https://www.googleapis.com/auth/business.manage). Please reconnect with all required permissions.';
      if (userId) setUserApiAccessState(userId, 'scope_missing', 'Missing required business.manage scope');
    } else if (lower.includes('not been used in project') || lower.includes('disabled') || lower.includes('has not been enabled') || lower.includes('access not configured')) {
      err.code = 'GOOGLE_API_ACCESS_DENIED';
      err.message = 'Google Business Profile API is not enabled in your Google Cloud project. Please enable the My Business Account Management and Business Information APIs.';
      if (userId) setUserApiAccessState(userId, 'access_denied', 'APIs not enabled in Google Cloud Console');
    } else if (lower.includes('access_denied') || lower.includes('denied') || lower.includes('forbidden') || lower.includes('caller does not have permission')) {
      err.code = 'GOOGLE_ACCESS_DENIED';
      err.message = `Google Business Profile access denied: ${errMessage}`;
      if (userId) setUserApiAccessState(userId, 'access_denied', errMessage);
    } else {
      err.code = 'GOOGLE_API_ACCESS_DENIED';
      err.message = `Google Business Profile access denied: ${errMessage}`;
      if (userId) setUserApiAccessState(userId, 'pending', errMessage);
    }
  } else if (status === 404) {
    err.code = 'GOOGLE_RESOURCE_NOT_FOUND';
    err.message = `Requested Google Business resource was not found: ${errMessage}`;
  } else {
    err.code = 'GOOGLE_API_ERROR';
    err.message = `Google API error: ${errMessage}`;
  }

  throw err;
}

/**
 * Raw call to list all GBP accounts from Google API with persistent interceptor.
 * Safe logging applied (no tokens logged).
 */
export async function getBusinessAccounts(accessToken: string, userId?: number): Promise<BusinessAccount[]> {
  console.log('[GBP API]', 'accounts.list', userId ? `userId: ${userId}` : '');

  const response = await gbpInterceptedFetch(
    `${GBP_ACCOUNT_MANAGEMENT_API}/accounts`,
    {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
    },
    'getBusinessAccounts',
    userId
  );

  const data = await response.json();
  const rawAccounts: any[] = data.accounts || [];

  return rawAccounts.map(acc => ({
    name: acc.name, // e.g. "accounts/1029384756"
    accountName: acc.accountName || acc.name || 'Personal Account',
    type: acc.type || 'PERSONAL',
  }));
}

/**
 * Retrieves cached Google Business Accounts directly from the local database.
 */
export async function getCachedBusinessAccounts(userId: number): Promise<BusinessAccount[]> {
  const records = await db.select().from(googleBusinessAccounts).where(eq(googleBusinessAccounts.userId, userId));
  return records.map(r => ({
    name: r.googleAccountId,
    accountName: r.accountName || 'Personal Account',
    type: r.accountType || 'PERSONAL',
    lastSyncedAt: r.lastSyncedAt
  }));
}

/**
 * High-level Account Discovery with Cache TTL, In-Memory Deduplication & Persistent 429 Interceptor.
 * 
 * - If cached data is present in database: returns local database accounts immediately (0 API calls).
 * - If force === true (Explicit 'Refresh Google Account' button): fetches fresh accounts from Google.
 * - If in persistent 429 cooldown: returns cached data without calling Google.
 * - Deduplicates concurrent requests for the same user into a single promise.
 * - Upserts newly discovered accounts to the database.
 */
export async function getOrFetchBusinessAccounts(
  userId: number,
  accessToken: string,
  force = false
): Promise<{ accounts: BusinessAccount[]; fromCache: boolean; rateLimited?: boolean; quotaNotGranted?: boolean }> {
  // 1. Check local DB cached accounts
  const cached = await getCachedBusinessAccounts(userId);
  const now = Date.now();

  const hasCachedAccounts = cached.length > 0;

  // If not forcing refresh and cached account is available, NEVER call Google accounts.list
  if (!force && hasCachedAccounts) {
    console.log('[GBP CACHE]', 'accounts.list skipped, serving cached accounts from DB for user', userId, `(${cached.length} accounts)`);
    return { accounts: cached, fromCache: true };
  }

  // 2. Check Persistent 429 Cooldown
  const cooldown = isAccountInCooldown(userId, 'mybusinessaccountmanagement.googleapis.com');
  if (cooldown.inCooldown) {
    console.warn(`[GBP COOLDOWN ACTIVE] User ${userId} / Account Management is rate-limited. Serving ${cached.length} cached accounts (${cooldown.remainingSeconds}s remaining).`);
    if (cached.length > 0) {
      return { accounts: cached, fromCache: true, rateLimited: true, quotaNotGranted: cooldown.quotaNotGranted };
    }
    // Check if user has businessLocations in DB to synthesize fallback account
    const existingLocs = await db.select().from(businessLocations).where(eq(businessLocations.userId, userId));
    if (existingLocs.length > 0) {
      const fallbackAccName = existingLocs[0].googleAccountId || 'accounts/primary';
      const fallback: BusinessAccount = {
        name: fallbackAccName,
        accountName: existingLocs[0].businessName || 'Google Business Account',
        type: 'PERSONAL',
        lastSyncedAt: new Date()
      };
      return { accounts: [fallback], fromCache: true, rateLimited: true, quotaNotGranted: cooldown.quotaNotGranted };
    }
    const err: any = new Error(cooldown.quotaNotGranted 
      ? 'Google Business Profile API quota is not currently available for this project. Review the API quota/access configuration in Google Cloud Console.'
      : `Google API rate limit reached. Please wait ${cooldown.remainingSeconds}s and try Sync again.`);
    err.status = 429;
    err.code = cooldown.quotaNotGranted ? 'GOOGLE_API_QUOTA_NOT_GRANTED' : 'QUOTA_TEMPORARILY_EXCEEDED';
    err.retryAfter = cooldown.remainingSeconds;
    err.blockedLocally = true;
    throw err;
  }

  // 3. In-Memory Request Deduplication
  const existingPromise = accountRequests.get(userId);
  if (existingPromise) {
    console.log('[GBP DEDUP]', 'Joining existing in-flight accounts.list for user', userId);
    return existingPromise;
  }

  // 4. Create Deduplicated Fetch Promise
  const fetchPromise = (async () => {
    try {
      const freshAccounts = await getBusinessAccounts(accessToken, userId);
      const syncDate = new Date();

      // Upsert into google_business_accounts
      for (const acc of freshAccounts) {
        const existing = await db.select().from(googleBusinessAccounts).where(and(
          eq(googleBusinessAccounts.userId, userId),
          eq(googleBusinessAccounts.googleAccountId, acc.name)
        )).limit(1);

        if (existing.length === 0) {
          await db.insert(googleBusinessAccounts).values({
            userId,
            googleAccountId: acc.name,
            accountName: acc.accountName,
            accountType: acc.type,
            lastSyncedAt: syncDate,
            updatedAt: syncDate,
          });
        } else {
          await db.update(googleBusinessAccounts).set({
            accountName: acc.accountName,
            accountType: acc.type,
            lastSyncedAt: syncDate,
            updatedAt: syncDate,
          }).where(eq(googleBusinessAccounts.id, existing[0].id));
        }
      }

      // Update user googleLastSyncedAt
      await db.update(users).set({ googleLastSyncedAt: syncDate }).where(eq(users.id, userId));
      setUserApiAccessState(userId, 'ready');

      return {
        accounts: freshAccounts.map(a => ({ ...a, lastSyncedAt: syncDate })),
        fromCache: false
      };
    } catch (err: any) {
      if (err.status === 429 || err.code === 'GOOGLE_RATE_LIMITED' || err.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || err.code === 'QUOTA_TEMPORARILY_EXCEEDED') {
        console.warn('[GBP FALLBACK] 429 encountered during account discovery for user', userId);
        if (cached.length > 0) {
          return { accounts: cached, fromCache: true, rateLimited: true, quotaNotGranted: err.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || quotaNotGranted };
        }
        // Synthesize fallback from businessLocations if present
        const existingLocs = await db.select().from(businessLocations).where(eq(businessLocations.userId, userId));
        if (existingLocs.length > 0) {
          const fallbackAccName = existingLocs[0].googleAccountId || 'accounts/primary';
          const fallback: BusinessAccount = {
            name: fallbackAccName,
            accountName: existingLocs[0].businessName || 'Google Business Account',
            type: 'PERSONAL',
            lastSyncedAt: new Date()
          };
          return { accounts: [fallback], fromCache: true, rateLimited: true, quotaNotGranted: err.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || quotaNotGranted };
        }
      }
      throw err;
    }
  })().finally(() => {
    accountRequests.delete(userId);
  });

  accountRequests.set(userId, fetchPromise);
  return fetchPromise;
}

/**
 * Fetches all managed business locations for an account.
 * accountId should be formatted as 'accounts/{accountId}' or '{accountId}'
 */
export async function getLocations(accessToken: string, accountNameOrId: string, userId?: number): Promise<BusinessLocation[]> {
  const accountPath = accountNameOrId.startsWith('accounts/') ? accountNameOrId : `accounts/${accountNameOrId}`;
  console.log('[GBP API]', 'locations.list', accountPath);

  const fields = 'name,title,storeCode,phoneNumbers,categories,regularHours,websiteUri,profile,storefrontAddress,latlng';
  
  try {
    const response = await gbpInterceptedFetch(
      `${GBP_BUSINESS_INFO_API}/${accountPath}/locations?readMask=${encodeURIComponent(fields)}`,
      {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
      },
      `getLocations for ${accountPath}`,
      userId
    );

    const data = await response.json();
    return data.locations || [];
  } catch (err: any) {
    if (err.status === 429 || err.code === 'GOOGLE_RATE_LIMITED' || err.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || err.code === 'QUOTA_TEMPORARILY_EXCEEDED') {
      console.warn(`[GBP RATE LIMITED] getLocations for ${accountPath} rate limited. Serving local database locations.`);
      if (userId) {
        const localLocs = await db.select().from(businessLocations).where(eq(businessLocations.userId, userId));
        return localLocs.map(l => ({
          name: l.googleLocationId,
          title: l.businessName,
          websiteUri: l.websiteUri || undefined,
          phoneNumbers: l.phone ? { primaryPhone: l.phone } : undefined,
          categories: l.category ? { primaryCategory: { displayName: l.category } } : undefined,
          profile: l.description ? { description: l.description } : undefined,
          latlng: (l.latitude && l.longitude) ? { latitude: l.latitude, longitude: l.longitude } : undefined
        }));
      }
    }
    throw err;
  }
}

/**
 * Helper to build the parent resource name for v4 API (reviews, posts).
 */
function buildV4LocationPath(locationIdStr: string, accountIdStr?: string): string {
  if (locationIdStr.startsWith('accounts/') && locationIdStr.includes('/locations/')) {
    return locationIdStr;
  }
  if (accountIdStr) {
    const acc = accountIdStr.startsWith('accounts/') ? accountIdStr : `accounts/${accountIdStr}`;
    const locId = locationIdStr.startsWith('locations/') ? locationIdStr.replace('locations/', '') : locationIdStr;
    return `${acc}/locations/${locId}`;
  }
  return locationIdStr;
}

/**
 * Fetches customer reviews for a location.
 */
export async function fetchGoogleReviews(accessToken: string, locationId: string, accountId?: string, userId?: number): Promise<GoogleReview[]> {
  const locationPath = buildV4LocationPath(locationId, accountId);
  console.log('[GBP API]', 'reviews.list', locationPath);

  try {
    const response = await gbpInterceptedFetch(
      `${GBP_API}/${locationPath}/reviews?pageSize=50`,
      {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
      },
      `fetchGoogleReviews for ${locationPath}`,
      userId
    );

    const data = await response.json();
    return data.reviews || [];
  } catch (err: any) {
    if (err.status === 429 || err.code === 'GOOGLE_RATE_LIMITED' || err.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || err.code === 'QUOTA_TEMPORARILY_EXCEEDED') {
      console.warn(`[GBP RATE LIMITED] fetchGoogleReviews for ${locationPath} rate limited.`);
      return [];
    }
    throw err;
  }
}

/**
 * Posts a reply directly to a Google review.
 */
export async function replyToGoogleReview(
  accessToken: string, 
  locationId: string, 
  reviewId: string, 
  replyText: string,
  accountId?: string,
  userId?: number
): Promise<any> {
  const locationPath = buildV4LocationPath(locationId, accountId);
  console.log('[GBP API]', 'reviewReply.put', locationPath, reviewId);

  const response = await gbpInterceptedFetch(
    `${GBP_API}/${locationPath}/reviews/${reviewId}/reply`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ comment: replyText }),
    },
    `replyToGoogleReview for review ${reviewId}`,
    userId
  );

  return response.json();
}

/**
 * Publishes a post to the Google profile.
 */
export async function createGooglePost(
  accessToken: string, 
  locationId: string, 
  summary: string, 
  imageUrl?: string,
  callToAction?: { actionType: string; url?: string },
  accountId?: string,
  userId?: number
): Promise<any> {
  const locationPath = buildV4LocationPath(locationId, accountId);
  console.log('[GBP API]', 'localPost.create', locationPath);

  const payload: any = {
    languageCode: 'en-US',
    summary,
    topicType: 'STANDARD',
  };

  if (callToAction && callToAction.url) {
    payload.callToAction = {
      actionType: callToAction.actionType || 'LEARN_MORE',
      url: callToAction.url
    };
  }

  if (imageUrl) {
    payload.media = [
      {
        mediaFormat: 'PHOTO',
        sourceUrl: imageUrl,
      },
    ];
  }

  const response = await gbpInterceptedFetch(
    `${GBP_API}/${locationPath}/localPosts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
    },
    `createGooglePost for ${locationPath}`,
    userId
  );

  return response.json();
}

/**
 * Fetches performance metrics (profile views, website clicks, calls, search views).
 */
export async function fetchPerformanceMetrics(accessToken: string, locationId: string, userId?: number): Promise<any> {
  const locationName = locationId.includes('/locations/') ? `locations/${locationId.split('/locations/')[1]}` : locationId;
  console.log('[GBP API]', 'metrics.fetch', locationName);

  const metrics = 'WEBSITE_CLICKS,CALL_CLICKS,PROFILE_VIEWS,SEARCH_VIEWS_MAPS,SEARCH_VIEWS_SEARCH';
  const url = `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=${metrics}`;

  try {
    const response = await gbpInterceptedFetch(
      url,
      {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
      },
      `fetchPerformanceMetrics for ${locationName}`,
      userId
    );

    return response.json();
  } catch (err: any) {
    if (err.status === 429 || err.code === 'GOOGLE_RATE_LIMITED' || err.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || err.code === 'QUOTA_TEMPORARILY_EXCEEDED') {
      console.warn(`[GBP RATE LIMITED] fetchPerformanceMetrics for ${locationName} rate limited.`);
      return null;
    }
    throw err;
  }
}
