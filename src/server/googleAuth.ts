import { db } from '../db/index.ts';
import { users, googleBusinessAccounts } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { google } from 'googleapis';
import { setUserApiAccessState } from '../lib/rateLimitCache.ts';

export interface GoogleTokenRecord {
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
}

export const ACTIVE_GOOGLE_CLIENT_ID = '1011063310836-icen8bjk8ck7n5252cp69h1csvtli30b.apps.googleusercontent.com';

export function getGoogleClientId(): string {
  let envId = process.env.GOOGLE_CLIENT_ID?.trim();
  // Remove every old OAuth client ID beginning 817066
  if (envId && envId.startsWith('817066')) {
    envId = '';
  }
  if (!envId || envId === 'your_google_client_id.apps.googleusercontent.com') {
    return ACTIVE_GOOGLE_CLIENT_ID;
  }
  return envId;
}

export function getGoogleClientSecret(): string {
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!envSecret || envSecret === 'your_google_client_secret') {
    return '';
  }
  return envSecret;
}

export function isGoogleOAuthConfigured(): boolean {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  return Boolean(clientId && clientSecret);
}

export function getOAuth2Client(redirectUri?: string) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Derives the canonical Google OAuth Redirect URI.
 * Excludes any Supabase Auth callback URIs and prioritizes production APP_URL.
 */
export function getGoogleOAuthRedirectUri(reqHost?: string, protocol = 'https'): string {
  const configuredUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  
  // If explicitly configured and not pointing to Supabase Auth callback
  if (configuredUri && !configuredUri.includes('supabase.co') && !configuredUri.includes('/auth/v1/callback')) {
    return configuredUri;
  }

  // If APP_URL is configured in environment
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    const cleanAppUrl = appUrl.replace(/\/+$/, '');
    return `${cleanAppUrl}/api/google/callback`;
  }

  // Use dynamic request host if available (Cloud Run / AI Studio preview / localhost)
  if (reqHost) {
    return `${protocol}://${reqHost}/api/google/callback`;
  }

  // Fallback domain default
  return 'https://www.dhanusgoldfitness.com/api/google/callback';
}

import crypto from 'node:crypto';

export function generateSignedState(userId: number, extra: any = {}): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET || 'fallback-secret-for-state-signing';
  const data = JSON.stringify({ userId, ts: Date.now(), ...extra });
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  const payload = JSON.stringify({ data, sig: hmac });
  return Buffer.from(payload).toString('base64');
}

/**
 * Validates and decodes the OAuth state parameter to extract the authenticated user ID.
 */
export function validateGoogleOAuthState(state: string | null | undefined): number | null {
  if (!state || typeof state !== 'string') {
    return null;
  }
  try {
    const secret = process.env.GOOGLE_CLIENT_SECRET || 'fallback-secret-for-state-signing';
    const payload = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    const { data, sig } = payload;
    if (!data || !sig) {
      console.error('[GOOGLE STATE VALIDATION ERROR] Missing data or signature in state');
      return null;
    }
    const computedHmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    if (computedHmac !== sig) {
      console.error('[GOOGLE STATE VALIDATION ERROR] Invalid state signature!');
      return null;
    }
    const decoded = JSON.parse(data);
    
    // Check if state is expired (older than 30 minutes)
    if (Date.now() - decoded.ts > 30 * 60 * 1000) {
      console.error('[GOOGLE STATE VALIDATION ERROR] State expired!');
      return null;
    }
    
    return typeof decoded.userId === 'number' ? decoded.userId : null;
  } catch (err) {
    console.error('[GOOGLE STATE VALIDATION ERROR]', err instanceof Error ? err.message : err);
    return null;
  }
}

export class GoogleNotConnectedError extends Error {
  code = 'GOOGLE_NOT_CONNECTED';
  status = 401;
  constructor(message = 'Connect Google Business Profile first.') {
    super(message);
    this.name = 'GoogleNotConnectedError';
  }
}

export class GoogleReauthRequiredError extends Error {
  code = 'GOOGLE_REAUTH_REQUIRED';
  status = 401;
  constructor(message = 'Google authorization has expired. Please reconnect your Google account.') {
    super(message);
    this.name = 'GoogleReauthRequiredError';
  }
}

/**
 * Gets a valid Google access token for the given user ID.
 * Refreshes the token automatically if expired and a refresh token is present.
 * Only throws GOOGLE_NOT_CONNECTED when BOTH access and refresh tokens are absent.
 */
export async function getValidGoogleAccessToken(userId: number): Promise<string> {
  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRecord || userRecord.length === 0) {
    const err: any = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  const user = userRecord[0];

  // Only throw GOOGLE_NOT_CONNECTED when BOTH values are missing
  if (!user.googleAccessToken && !user.googleRefreshToken) {
    throw new GoogleNotConnectedError('Connect Google Business Profile first.');
  }

  const now = Date.now();
  const expiresAtMs = user.googleTokenExpiresAt ? new Date(user.googleTokenExpiresAt).getTime() : 0;
  const isExpired = expiresAtMs > 0 ? (expiresAtMs <= now + 60000) : false;

  // Log stored connection details before returning token
  console.log('STORED GOOGLE SCOPES:', user.googleScopes);

  // 1. If access token exists and is still valid, return it
  if (user.googleAccessToken && !isExpired) {
    return user.googleAccessToken;
  }

  // 2. If refresh token is available, attempt refresh
  if (user.googleRefreshToken) {
    try {
      return await refreshGoogleAccessToken(userId);
    } catch (refreshErr: any) {
      if (refreshErr.code === 'GOOGLE_REAUTH_REQUIRED') {
        throw refreshErr;
      }
      if (user.googleAccessToken) {
        console.warn(`[GOOGLE AUTH] Refresh failed for user ${userId}, falling back to existing access token`);
        return user.googleAccessToken;
      }
      throw refreshErr;
    }
  }

  // 3. If access token is present without refresh token, return it (e.g. testing mode or cached token)
  if (user.googleAccessToken) {
    return user.googleAccessToken;
  }

  throw new GoogleNotConnectedError('Connect Google Business Profile first.');
}

/**
 * Explicitly forces a refresh of the user's Google OAuth access token using their stored refresh token.
 */
export async function refreshGoogleAccessToken(userId: number): Promise<string> {
  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRecord || userRecord.length === 0) {
    const err: any = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  const user = userRecord[0];

  if (!user.googleRefreshToken) {
    throw new GoogleReauthRequiredError('No Google refresh token found. Please reconnect your Google account.');
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    const err: any = new Error('Google OAuth credentials not configured on backend.');
    err.code = 'CONFIGURATION_REQUIRED';
    err.status = 409;
    throw err;
  }

  console.log(`[GOOGLE AUTH] Refreshing expired token for user ${userId}...`);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: user.googleRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('[GOOGLE AUTH REFRESH ERROR]', data);
    if (data.error === 'invalid_grant' || data.error === 'unauthorized_client') {
      throw new GoogleReauthRequiredError('Google connection has expired or was revoked. Please reconnect.');
    }
    const err: any = new Error(data.error_description || data.error || 'Failed to refresh Google token');
    err.code = 'GOOGLE_REFRESH_FAILED';
    err.status = 401;
    throw err;
  }

  const newAccessToken = data.access_token;
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000);
  const refreshTokenToSave = data.refresh_token || user.googleRefreshToken;

  await db.update(users).set({
    googleAccessToken: newAccessToken,
    googleRefreshToken: refreshTokenToSave,
    googleTokenExpiresAt: newExpiresAt,
  }).where(eq(users.id, userId));

  console.log(`[GOOGLE AUTH] Token refreshed successfully for user ${userId}`);
  return newAccessToken;
}

export interface GoogleAccountVerificationResult {
  success: boolean;
  status: number | null;
  accounts?: Array<{
    name: string;
    accountName: string;
    type: string;
  }>;
  error?: string;
  requiredScope?: string;
  googleError?: any;
}

/**
 * Calls https://mybusinessaccountmanagement.googleapis.com/v1/accounts
 * - If successful: returns account information.
 * - If 401: refreshes the access token and retries once.
 * - If 403: returns the exact Google API error message and required scope.
 */
export async function verifyAndFetchGoogleAccounts(
  userId: number,
  initialAccessToken?: string
): Promise<GoogleAccountVerificationResult> {
  const url = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
  const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/business.manage';

  let token = initialAccessToken;
  if (!token) {
    try {
      token = await getValidGoogleAccessToken(userId);
    } catch (e: any) {
      return {
        success: false,
        status: e.status || 401,
        error: e.message || 'No valid access token found',
        requiredScope: REQUIRED_SCOPE,
      };
    }
  }

  const executeCall = async (authToken: string) => {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
    });
  };

  let response: Response;
  try {
    response = await executeCall(token);
  } catch (netErr: any) {
    return {
      success: false,
      status: null,
      error: netErr.message || 'Network error connecting to Google API',
      requiredScope: REQUIRED_SCOPE,
    };
  }

  // If 401, refresh the access token and retry once
  if (response.status === 401) {
    console.warn(`[GBP ACCOUNTS API] Received 401 Unauthorized for user ${userId}. Refreshing access token and retrying once...`);
    try {
      token = await refreshGoogleAccessToken(userId);
      response = await executeCall(token);
    } catch (refreshErr: any) {
      console.error(`[GBP ACCOUNTS API] Token refresh failed on 401 retry:`, refreshErr.message);
      return {
        success: false,
        status: 401,
        error: refreshErr.message || 'Unauthorized: Token expired and refresh failed',
        requiredScope: REQUIRED_SCOPE,
      };
    }
  }

  // If successful: return account information
  if (response.ok) {
    try {
      const data = await response.json();
      const rawAccounts: any[] = data.accounts || [];
      const accounts = rawAccounts.map((acc: any) => ({
        name: acc.name,
        accountName: acc.accountName || acc.name || 'Personal Account',
        type: acc.type || 'PERSONAL',
      }));

      // Save to database
      for (const acc of accounts) {
        await db.insert(googleBusinessAccounts).values({
          userId,
          googleAccountId: acc.name,
          accountName: acc.accountName,
          accountType: acc.type,
          lastSyncedAt: new Date(),
        }).onConflictDoUpdate({
          target: [googleBusinessAccounts.googleAccountId],
          set: {
            accountName: acc.accountName,
            accountType: acc.type,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      await db.update(users).set({ googleLastSyncedAt: new Date() }).where(eq(users.id, userId));
      setUserApiAccessState(userId, 'ready', null);

      return {
        success: true,
        status: 200,
        accounts,
      };
    } catch (parseErr: any) {
      return {
        success: false,
        status: response.status,
        error: parseErr.message,
        requiredScope: REQUIRED_SCOPE,
      };
    }
  }

  // If 403, return the exact Google API error message and required scope
  if (response.status === 403) {
    let errorJson: any = null;
    try {
      errorJson = await response.json();
    } catch {
      errorJson = { error: { message: response.statusText } };
    }
    const exactMessage = errorJson?.error?.message || response.statusText || 'Access forbidden';
    console.error(`[GBP ACCOUNTS API 403 FORBIDDEN] User ${userId}: ${exactMessage}`);

    setUserApiAccessState(userId, 'scope_missing', exactMessage);

    return {
      success: false,
      status: 403,
      error: exactMessage,
      requiredScope: REQUIRED_SCOPE,
      googleError: errorJson,
    };
  }

  // Other status codes (e.g. 429)
  let errorData: any = null;
  try {
    errorData = await response.json();
  } catch {
    errorData = { error: { message: response.statusText } };
  }
  const errorMsg = errorData?.error?.message || response.statusText || `Google API error ${response.status}`;

  return {
    success: false,
    status: response.status,
    error: errorMsg,
    requiredScope: REQUIRED_SCOPE,
    googleError: errorData,
  };
}

/**
 * Saves Google OAuth tokens to the database for the given user.
 * Preserves the existing refresh token if Google does not return a new one.
 */
export async function saveGoogleTokens(userId: number, tokens: any): Promise<void> {
  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const existing = userRecord[0];

  const existingRefreshToken = existing?.googleRefreshToken || null;
  const existingScopes = existing?.googleScopes || null;

  const scopes = tokens.scope || existingScopes || '';
  if (!scopes.includes('https://www.googleapis.com/auth/business.manage')) {
    const error: any = new Error('Required Google Business Profile management scope (https://www.googleapis.com/auth/business.manage) was not granted.');
    error.code = 'GOOGLE_SCOPE_MISSING';
    error.status = 403;
    throw error;
  }

  const refreshTokenToSave = tokens.refresh_token || existingRefreshToken;
  const expiresIn = typeof tokens.expires_in === 'number' 
    ? tokens.expires_in 
    : (tokens.expiry_date ? Math.max(0, Math.floor((tokens.expiry_date - Date.now()) / 1000)) : 3600);
  const expiresAt = tokens.expiry_date 
    ? new Date(tokens.expiry_date) 
    : new Date(Date.now() + expiresIn * 1000);

  const updateData: any = {
    googleAccessToken: tokens.access_token ?? existing?.googleAccessToken,
    googleTokenExpiresAt: expiresAt,
    googleConnectedAt: new Date(),
    googleScopes: scopes,
  };

  if (refreshTokenToSave) {
    updateData.googleRefreshToken = refreshTokenToSave;
  }

  await db.update(users).set(updateData).where(eq(users.id, userId));

  console.log(`[GOOGLE AUTH] Saved tokens for user ${userId}. Has access token: ${Boolean(updateData.googleAccessToken)}, Has refresh token: ${Boolean(refreshTokenToSave)}`);
}

/**
 * Disconnects Google Business Profile for the user by clearing saved tokens.
 */
export async function disconnectGoogleTokens(userId: number): Promise<void> {
  await db.update(users).set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiresAt: null,
    googleScopes: null,
    googleConnectedAt: null,
  }).where(eq(users.id, userId));

  console.log(`[GOOGLE AUTH] Cleared tokens for user ${userId}`);
}
