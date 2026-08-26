import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface GoogleTokenRecord {
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
}

const DEFAULT_GOOGLE_CLIENT_ID = '998070896185-9csa32q0nt5pitjaqip21lsum55l7m0n.apps.googleusercontent.com';
const DEFAULT_GOOGLE_CLIENT_SECRET = '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';

export function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_CLIENT_ID;
}

export function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || DEFAULT_GOOGLE_CLIENT_SECRET;
}

export function isGoogleOAuthConfigured(): boolean {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  return Boolean(clientId && clientSecret);
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

/**
 * Validates and decodes the OAuth state parameter to extract the authenticated user ID.
 */
export function validateGoogleOAuthState(state: string | null | undefined): number | null {
  if (!state || typeof state !== 'string') {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
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

  // 1. If access token exists and is still valid, return it
  if (user.googleAccessToken && !isExpired) {
    return user.googleAccessToken;
  }

  // 2. If refresh token is available, attempt refresh
  if (user.googleRefreshToken) {
    const clientId = getGoogleClientId();
    const clientSecret = getGoogleClientSecret();

    if (!clientId || !clientSecret) {
      if (user.googleAccessToken) {
        return user.googleAccessToken;
      }
      const err: any = new Error('Google OAuth credentials not configured on backend.');
      err.code = 'CONFIGURATION_REQUIRED';
      err.status = 409;
      throw err;
    }

    try {
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
        if (user.googleAccessToken) {
          return user.googleAccessToken;
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
 * Saves Google OAuth tokens to the database for the given user.
 * Preserves the existing refresh token if Google does not return a new one.
 */
export async function saveGoogleTokens(userId: number, tokens: any): Promise<void> {
  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const existing = userRecord[0];

  const existingRefreshToken = existing?.googleRefreshToken || null;
  const existingScopes = existing?.googleScopes || null;

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
    googleScopes: tokens.scope || existingScopes || 'https://www.googleapis.com/auth/business.manage',
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
