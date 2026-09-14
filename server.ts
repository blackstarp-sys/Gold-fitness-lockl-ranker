if (typeof globalThis !== 'undefined' && (globalThis as any).__dirname === '.') {
  (globalThis as any).__dirname = process.cwd();
}

import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { adminAuth } from './src/lib/firebase-admin.ts';
import cron from 'node-cron';
import { db, getDbStorageMode } from './src/db/index.ts';
import { scheduledPosts, reviews, socialAccounts, businessLocations, seoKeywords, keywordRankHistory, competitors, citationSources, campaigns, campaignLogs, users, seoAudits, metricLogs, aiCreditAccounts, aiCreditTransactions, googleBusinessAccounts, appSettings } from './src/db/schema.ts';
import { eq, and, lte, desc, count, inArray, asc, sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ override: true });
if (process.env.GOOGLE_CLIENT_ID?.startsWith('817066')) {
  process.env.GOOGLE_CLIENT_ID = '1011063310836-icen8bjk8ck7n5252cp69h1csvtli30b.apps.googleusercontent.com';
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { installGlobalApiInterceptor } from './src/lib/globalApiInterceptor.ts';
import { generateReviewReply, generatePostCaption } from './src/lib/gemini.ts';

// Initialize global API interceptor to monitor and locally block 429 rate limits
installGlobalApiInterceptor();
import { 
  getValidGoogleAccessToken, 
  saveGoogleTokens, 
  disconnectGoogleTokens, 
  isGoogleOAuthConfigured, 
  getGoogleOAuthRedirectUri,
  validateGoogleOAuthState,
  generateSignedState,
  getGoogleClientId,
  getGoogleClientSecret,
  getOAuth2Client,
  verifyAndFetchGoogleAccounts,
  refreshGoogleAccessToken
} from './src/server/googleAuth.ts';
import { 
  getBusinessAccounts, 
  getOrFetchBusinessAccounts,
  getCachedBusinessAccounts,
  isAccountInCooldown,
  getLocations, 
  fetchGoogleReviews, 
  fetchPerformanceMetrics, 
  replyToGoogleReview, 
  createGooglePost 
} from './src/lib/googleBusiness.ts';
import { getUserApiAccessState, setUserApiAccessState } from './src/lib/rateLimitCache.ts';
import { getSupabaseUrl, getSupabaseAnonKey } from './src/lib/supabase.ts';

app.get('/api/supabase/status', (req, res) => {
  const url = getSupabaseUrl();
  const hasAnonKey = Boolean(getSupabaseAnonKey());
  res.json({
    success: true,
    configured: Boolean(url && hasAnonKey),
    url,
    projectRef: 'raotxtpvnypaijnbfelo',
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({
      success: true,
      server: 'ok',
      database: 'connected',
      mode: getDbStorageMode()
    });
  } catch (error) {
    console.error('[HEALTH CHECK DB ERROR]', error instanceof Error ? error.message : error);
    res.status(500).json({
      success: false,
      server: 'ok',
      database: 'disconnected',
      mode: getDbStorageMode()
    });
  }
});

// Server Auth Configuration & Current User Profile
app.get('/api/auth/config', (req, res) => {
  const ownerEmail = (process.env.OWNER_EMAIL || 'dhanusgoldfitness@gmail.com').trim().toLowerCase();
  res.json({
    success: true,
    ownerEmail,
    googleClientId: getGoogleClientId(),
  });
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  const ownerEmail = (process.env.OWNER_EMAIL || 'dhanusgoldfitness@gmail.com').trim().toLowerCase();
  const isOwner = req.dbUser?.email?.toLowerCase() === ownerEmail || req.dbUser?.role === 'owner';
  res.json({
    success: true,
    user: {
      id: req.dbUser?.id,
      uid: req.dbUser?.uid,
      email: req.dbUser?.email,
      name: req.dbUser?.name,
      role: req.dbUser?.role || (isOwner ? 'owner' : 'user'),
      isOwner,
      selectedGoogleAccountId: req.dbUser?.selectedGoogleAccountId || null,
      selectedGoogleLocationId: req.dbUser?.selectedGoogleLocationId || null,
    }
  });
});

// Google Business Status Endpoint (Reads purely from local DB/token state - 0 external Google API calls)
app.get('/api/google/status', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const isConfigured = isGoogleOAuthConfigured();
    const ownerEmail = (process.env.OWNER_EMAIL || 'dhanusgoldfitness@gmail.com').trim().toLowerCase();
    const ownerRecord = (await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
    const targetUserId = req.dbUser?.id || ownerRecord?.id || (await db.select().from(users).limit(1))[0]?.id;

    if (!targetUserId) {
      return res.json({
        success: true,
        configured: isConfigured,
        oauthConnected: false,
        connected: false,
        apiAccess: 'unknown',
        status: 'NOT_CONNECTED',
        connectedAt: null,
        lastSyncedAt: null,
        accounts: 0,
        locations: 0,
        scopes: null,
        accountEmail: null,
        rateLimited: false,
        cooldownSeconds: 0,
        quotaNotGranted: false
      });
    }

    const user = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    const userLocations = await db.select({ count: count() }).from(businessLocations).where(eq(businessLocations.userId, targetUserId));
    const cachedAccounts = await db.select().from(googleBusinessAccounts).where(eq(googleBusinessAccounts.userId, targetUserId));
    
    // Inspect token storage: google_access_token or google_refresh_token
    const hasOAuthToken = Boolean(user[0]?.googleAccessToken || user[0]?.googleRefreshToken);
    const cooldown = isAccountInCooldown(targetUserId);
    const recordedApiState = getUserApiAccessState(targetUserId);

    // Safe logging (never log actual tokens)
    console.log('[GOOGLE STATUS]', {
      dbUserId: targetUserId,
      hasAccessToken: Boolean(user[0]?.googleAccessToken),
      hasRefreshToken: Boolean(user[0]?.googleRefreshToken),
      connectedAt: user[0]?.googleConnectedAt
    });

    // Compute the 4 distinct states:
    // 1. NOT_CONNECTED: No Google OAuth token or refresh token stored
    // 2. CONNECTED_API_PENDING: OAuth token exists, but Google Business API access is unverified or returns quota error
    // 3. CONNECTED_READY: OAuth token exists and Google Business API calls succeed (verified access)
    // 4. REAUTH_REQUIRED: Invalid grant, revoked token, or insufficient scopes
    let status: 'NOT_CONNECTED' | 'CONNECTED_API_PENDING' | 'CONNECTED_READY' | 'REAUTH_REQUIRED' = 'NOT_CONNECTED';
    let apiAccess: 'ready' | 'pending' | 'unknown' = 'unknown';

    if (!hasOAuthToken) {
      status = 'NOT_CONNECTED';
      apiAccess = 'unknown';
    } else {
      const scopesStr = user[0]?.googleScopes || '';
      const hasRequiredScope = scopesStr.includes('https://www.googleapis.com/auth/business.manage') || scopesStr.includes('business.manage');

      if (!hasRequiredScope) {
        status = 'REAUTH_REQUIRED';
        apiAccess = 'pending';
      } else if (recordedApiState?.state === 'scope_missing' || recordedApiState?.state === 'reauth_required' || recordedApiState?.reason?.toLowerCase().includes('reauth') || recordedApiState?.reason?.toLowerCase().includes('invalid_grant')) {
        status = 'REAUTH_REQUIRED';
        apiAccess = 'pending';
      } else if (recordedApiState?.state === 'ready') {
        status = 'CONNECTED_READY';
        apiAccess = 'ready';
      } else if (recordedApiState?.state === 'access_denied') {
        status = 'REAUTH_REQUIRED';
        apiAccess = 'pending';
      } else {
        // OAuth token exists, but API access is unverified
        status = 'CONNECTED_API_PENDING';
        apiAccess = 'pending';
      }
    }

    res.json({
      success: true,
      configured: isConfigured,
      oauthConnected: hasOAuthToken,
      connected: hasOAuthToken, // backward compatibility
      apiAccess,
      status,
      connectedAt: user[0]?.googleConnectedAt || null,
      lastSyncedAt: user[0]?.googleLastSyncedAt || (cachedAccounts[0]?.lastSyncedAt) || null,
      accounts: cachedAccounts.length,
      locations: userLocations[0]?.count ? Number(userLocations[0].count) : 0,
      scopes: user[0]?.googleScopes || null,
      accountEmail: user[0]?.email || null,
      rateLimited: cooldown.inCooldown,
      cooldownSeconds: cooldown.remainingSeconds,
      quotaNotGranted: cooldown.quotaNotGranted
    });
  } catch (error: any) {
    console.error('[GOOGLE STATUS ERROR]', error.message);
    res.status(500).json({ success: false, code: 'STATUS_FAILED', message: 'Failed to fetch Google status' });
  }
});

// Diagnostic endpoint (Requirement 7)
// Returns ONLY safe values:
// { configured, hasAccessToken, hasRefreshToken, businessManageScope, callbackUrl, accountApiStatus }
// Never returns client_secret, refresh_token or access_token.
app.get('/api/google/diagnostics', requireAuth, async (req: AuthRequest, res) => {
  try {
    const configured = isGoogleOAuthConfigured();
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const callbackUrl = getGoogleOAuthRedirectUri(host, protocol);

    const targetUserId = req.dbUser.id;
    const u = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    const targetUser = u[0] || null;

    const hasAccessToken = Boolean(targetUser?.googleAccessToken);
    const hasRefreshToken = Boolean(targetUser?.googleRefreshToken);
    const businessManageScope = Boolean(
      targetUser?.googleScopes && 
      (targetUser.googleScopes.includes('business.manage') || targetUser.googleScopes.includes('https://www.googleapis.com/auth/business.manage'))
    );

    let accountApiStatus: 200 | 401 | 403 | number | null = null;

    if (hasAccessToken || hasRefreshToken) {
      try {
        const verifyResult = await verifyAndFetchGoogleAccounts(targetUserId);
        accountApiStatus = verifyResult.status;
      } catch (verifyErr: any) {
        accountApiStatus = verifyErr.status || 500;
      }
    }

    const rawClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    res.json({
      configured,
      hasAccessToken,
      hasRefreshToken,
      businessManageScope,
      callbackUrl,
      accountApiStatus,
      clientIdPrefix: rawClientId ? rawClientId.substring(0, 6) : null,
      staleClientOverrideDetected: false
    });
  } catch (err: any) {
    console.error('[DIAGNOSTICS ERROR]', err.message);
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    res.status(500).json({
      configured: isGoogleOAuthConfigured(),
      hasAccessToken: false,
      hasRefreshToken: false,
      businessManageScope: false,
      callbackUrl: getGoogleOAuthRedirectUri(host, protocol),
      accountApiStatus: null
    });
  }
});

// Return only accounts previously verified and cached from Google.
app.get('/api/google/accounts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const accounts = await getCachedBusinessAccounts(req.dbUser.id);

    res.json({
      success: true,
      accounts,
      count: accounts.length,
      message:
        accounts.length > 0
          ? 'Verified cached Google Business accounts loaded.'
          : 'No Google Business accounts have been synced.',
    });
  } catch (error: any) {
    console.error('[GOOGLE ACCOUNTS ERROR]', error?.message);

    res.status(500).json({
      success: false,
      code: 'GOOGLE_ACCOUNTS_LOAD_FAILED',
      message: 'Failed to load Google Business accounts.',
      accounts: [],
      count: 0,
    });
  }
});

// Set / Update Custom Business Account ID
app.post('/api/google/set-account-id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { accountId, accountName, locationName } = req.body;
    if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Valid Business Account ID is required.' });
    }

    const cleanId = accountId.trim();
    const formattedAccountId = cleanId.startsWith('accounts/') ? cleanId : `accounts/${cleanId}`;

    // Upsert into googleBusinessAccounts
    await db.insert(googleBusinessAccounts).values({
      userId: req.dbUser.id,
      googleAccountId: formattedAccountId,
      accountName: accountName || `Business Account (${cleanId.replace('accounts/', '')})`,
      accountType: 'LOCATION_GROUP',
      role: 'explicit_user_selection',
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [googleBusinessAccounts.googleAccountId],
      set: {
        accountName: accountName || `Business Account (${cleanId.replace('accounts/', '')})`,
        role: 'explicit_user_selection',
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    await db.update(users).set({
      selectedGoogleAccountId: formattedAccountId,
    }).where(eq(users.id, req.dbUser.id));

    // Also update existing businessLocations if present
    const existingLocations = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id));
    if (existingLocations.length > 0) {
      await db.update(businessLocations).set({
        googleAccountId: formattedAccountId,
      }).where(eq(businessLocations.userId, req.dbUser.id));
    }

    const updatedAccounts = await getCachedBusinessAccounts(req.dbUser.id);
    res.json({
      success: true,
      message: `Business Account ID '${formattedAccountId}' configured successfully!`,
      accountId: formattedAccountId,
      accounts: updatedAccounts,
    });
  } catch (error: any) {
    console.error('[SET ACCOUNT ID ERROR]', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update Business Account ID' });
  }
});

// Explicit Refresh Google OAuth Access Token
app.post(['/api/google/refresh', '/api/google/refresh-token'], requireAuth, async (req: AuthRequest, res) => {
  try {
    const newToken = await refreshGoogleAccessToken(req.dbUser.id);
    res.json({
      success: true,
      message: 'Access token refreshed successfully',
      hasToken: Boolean(newToken),
    });
  } catch (error: any) {
    console.error('[GOOGLE REFRESH ERROR]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'REFRESH_FAILED',
      message: error.message || 'Failed to refresh Google access token'
    });
  }
});

// Explicit Refresh Google Account (Explicitly requests fresh accounts from Google API)
app.post('/api/google/refresh-accounts', requireAuth, async (req: AuthRequest, res) => {
  console.log('[REFRESH USER]', {
    firebaseUid: req.dbUser?.uid,
    dbUserId: req.dbUser?.id,
    hasGoogleAccessToken: Boolean(req.dbUser?.googleAccessToken),
    hasGoogleRefreshToken: Boolean(req.dbUser?.googleRefreshToken),
    googleConnectedAt: req.dbUser?.googleConnectedAt
  });

  try {
    const token = await getValidGoogleAccessToken(req.dbUser.id);

    const { accounts, fromCache, rateLimited, quotaNotGranted } = await getOrFetchBusinessAccounts(req.dbUser.id, token, true);
    res.json({
      success: true,
      accounts: accounts.length,
      fromCache,
      rateLimited: !!rateLimited,
      quotaNotGranted: !!quotaNotGranted,
      data: accounts
    });
  } catch (error: any) {
    console.error('[REFRESH ACCOUNTS ERROR]', error.message);
    if (error.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || error.code === 'QUOTA_TEMPORARILY_EXCEEDED' || error.code === 'GOOGLE_RATE_LIMITED' || error.status === 429) {
      return res.status(429).json({
        success: false,
        code: 'GOOGLE_API_QUOTA_PENDING',
        message: 'Google Business Profile is connected, but API access/quota is currently pending.'
      });
    }
    if (error.code === 'GOOGLE_NOT_CONNECTED') {
      return res.status(401).json({
        success: false,
        code: 'GOOGLE_NOT_CONNECTED',
        message: 'Connect Google Business Profile first.'
      });
    }
    if (error.code === 'GOOGLE_REAUTH_REQUIRED') {
      return res.status(401).json({
        success: false,
        code: 'GOOGLE_REAUTH_REQUIRED',
        message: 'Google authorization has expired. Please reconnect your Google account.'
      });
    }

    const statusCode = error.status || (error.code === 'GOOGLE_SCOPE_MISSING' || error.code === 'GOOGLE_API_ACCESS_DENIED' ? 403 : 500);
    res.status(statusCode).json({
      success: false,
      code: error.code || 'REFRESH_FAILED',
      message: error.message || 'Failed to refresh Google accounts',
      retryAfter: error.retryAfter || null
    });
  }
});

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/business.manage',
];

// Google Business Connect / Auth URL Endpoints
app.get(['/api/google/connect', '/api/google/auth-url'], optionalAuth, async (req: AuthRequest, res) => {
  if (!isGoogleOAuthConfigured()) {
    return res.status(400).json({
      success: false,
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
      message: "Configure an active Google OAuth client in the server environment."
    });
  }

  const host = req.get('host');
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const redirectUri = getGoogleOAuthRedirectUri(host, protocol);

  const ownerEmail = (process.env.OWNER_EMAIL || 'dhanusgoldfitness@gmail.com').trim().toLowerCase();
  const ownerRecord = (await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
  const targetUserId = req.dbUser?.id || ownerRecord?.id || 1;
  const state = generateSignedState(targetUserId);
  const oauth2Client = getOAuth2Client(redirectUri);

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state: state,
  });

  console.log('[GOOGLE CONNECT] Generated auth URL for user', targetUserId, 'redirectUri:', redirectUri);

  const isJson = req.headers.accept?.includes('application/json') || 
                 req.headers['content-type']?.includes('application/json') || 
                 req.query.format === 'json' || 
                 req.xhr;

  if (isJson) {
    return res.json({
      success: true,
      authorizationUrl,
      url: authorizationUrl // backward compatibility
    });
  }

  return res.redirect(authorizationUrl);
});

// Google Business Reconnect Endpoint
// Clears existing stale credentials from local database before generating a fresh consent auth URL
const handleGoogleReconnect = async (req: AuthRequest, res: any) => {
  if (!isGoogleOAuthConfigured()) {
    return res.status(400).json({
      success: false,
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
      message: "Configure an active Google OAuth client in the server environment."
    });
  }

  try {
    const ownerEmail = (process.env.OWNER_EMAIL || 'dhanusgoldfitness@gmail.com').trim().toLowerCase();
    const ownerRecord = (await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
    const targetUserId = req.dbUser?.id || ownerRecord?.id || 1;

    // 1. Clear stale tokens and access state from the local database
    console.log(`[GOOGLE RECONNECT] Clearing stale credentials for user ${targetUserId}...`);
    await disconnectGoogleTokens(targetUserId);
    setUserApiAccessState(targetUserId, 'unknown', null);

    // 2. Build fresh OAuth URL with prompt=consent, access_type=offline, include_granted_scopes=true
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const redirectUri = getGoogleOAuthRedirectUri(host, protocol);

    const state = generateSignedState(targetUserId, { reconnect: true });
    const oauth2Client = getOAuth2Client(redirectUri);

    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: GOOGLE_SCOPES,
      state: state,
    });

    console.log(`[GOOGLE RECONNECT] Generated fresh consent auth URL for user ${targetUserId}`);

    const isJson = req.headers.accept?.includes('application/json') || 
                   req.headers['content-type']?.includes('application/json') || 
                   req.query.format === 'json' || 
                   req.xhr;

    if (isJson) {
      return res.json({
        success: true,
        cleared: true,
        authorizationUrl,
        url: authorizationUrl,
        message: 'Stale credentials cleared. Ready for fresh consent authorization.'
      });
    }

    return res.redirect(authorizationUrl);
  } catch (error: any) {
    console.error('[GOOGLE RECONNECT ERROR]', error.message);
    res.status(500).json({
      success: false,
      code: 'RECONNECT_FAILED',
      message: error.message || 'Failed to prepare reconnect flow'
    });
  }
};

app.get('/api/google/reconnect', optionalAuth, handleGoogleReconnect);
app.post('/api/google/reconnect', optionalAuth, handleGoogleReconnect);

// Google Business API Access Test Endpoint
// Explicitly tests Account Management API to verify Business Profile API access beyond OAuth login
app.post(['/api/google/test-api', '/api/google/verify-access'], requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    const hasOAuthToken = Boolean(user[0]?.googleAccessToken || user[0]?.googleRefreshToken);

    if (!hasOAuthToken) {
      return res.status(401).json({
        success: false,
        code: 'GOOGLE_NOT_CONNECTED',
        apiAccess: 'not_connected',
        message: 'No Google OAuth credentials found. Please connect your Google account first.'
      });
    }

    const token = await getValidGoogleAccessToken(req.dbUser.id);
    console.log(`[GOOGLE API TEST] Testing Account Management API for user ${req.dbUser.id}...`);

    const accounts = await getBusinessAccounts(token, req.dbUser.id);

    // Save discovered accounts
    if (Array.isArray(accounts) && accounts.length > 0) {
      for (const acc of accounts) {
        await db.insert(googleBusinessAccounts).values({
          userId: req.dbUser.id,
          googleAccountId: acc.name,
          accountName: acc.accountName,
          accountType: acc.type,
          lastSyncedAt: new Date()
        }).onConflictDoUpdate({
          target: [googleBusinessAccounts.googleAccountId],
          set: {
            accountName: acc.accountName,
            accountType: acc.type,
            lastSyncedAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }

    setUserApiAccessState(req.dbUser.id, 'ready', null);
    await db.update(users).set({ googleLastSyncedAt: new Date() }).where(eq(users.id, req.dbUser.id));

    res.json({
      success: true,
      apiAccess: 'ready',
      status: 'CONNECTED_READY',
      message: `Account Management API test passed! Found ${accounts.length} Google Business account(s).`,
      accountsCount: accounts.length,
      accounts
    });
  } catch (error: any) {
    console.error('[GOOGLE API TEST ERROR]', error.message, 'code:', error.code);
    const isQuotaIssue = error.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || error.code === 'QUOTA_TEMPORARILY_EXCEEDED' || error.status === 429;
    const isScopeIssue = error.code === 'GOOGLE_SCOPE_MISSING';
    const isAccessDenied = error.code === 'GOOGLE_API_ACCESS_DENIED' || error.code === 'GOOGLE_ACCESS_DENIED';
    const isReauth = error.code === 'GOOGLE_REAUTH_REQUIRED';

    let apiAccess = 'pending';
    let userMessage = error.message;

    if (isScopeIssue) {
      apiAccess = 'scope_missing';
      userMessage = 'Missing required scope (https://www.googleapis.com/auth/business.manage). Please disconnect and reconnect Google with all permissions checked.';
      setUserApiAccessState(req.dbUser.id, 'scope_missing', 'Missing required business.manage scope');
    } else if (isQuotaIssue) {
      apiAccess = 'pending';
      userMessage = 'Google OAuth token is valid, but Google Business Profile API quota is pending approval in Google Cloud Console.';
      setUserApiAccessState(req.dbUser.id, 'pending', 'Quota pending approval');
    } else if (isAccessDenied) {
      apiAccess = 'access_denied';
      userMessage = 'Google Business Profile API is not enabled in your Google Cloud project or access is restricted.';
      setUserApiAccessState(req.dbUser.id, 'access_denied', error.message);
    } else if (isReauth) {
      apiAccess = 'reauth_required';
      userMessage = 'Google authorization has expired or was revoked. Please disconnect and reconnect.';
      setUserApiAccessState(req.dbUser.id, 'reauth_required', error.message);
    }

    res.status(isQuotaIssue ? 429 : 200).json({
      success: false,
      code: error.code || 'API_TEST_FAILED',
      apiAccess,
      status: isReauth ? 'REAUTH_REQUIRED' : 'CONNECTED_API_PENDING',
      message: userMessage,
      details: {
        error: error.message,
        code: error.code,
        status: error.status,
        retryAfter: error.retryAfter || null
      }
    });
  }
});

// Google Business Callback Endpoint
const handleGoogleOAuthCallback = async (req: express.Request, res: express.Response) => {
  const { code, state, error, error_description } = req.query;
    const renderCallbackHtml = (success: boolean, code?: string, message?: string) => {
      if (success) {
        return `<!DOCTYPE html>
<html>
<head><title>Google Authorization Successful</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
  <div style="text-align: center; padding: 32px; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px;">
    <h3 style="color: #16a34a; margin-top: 0;">Connected Successfully</h3>
    <p style="color: #475569;">Your Google Business Profile has been authorized. You may now return to the app.</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
        setTimeout(() => window.close(), 600);
      } else {
        window.location.href = '/google-business?connected=1';
      }
    } catch (e) {
      window.location.href = '/google-business?connected=1';
    }
  </script>
</body>
</html>`;
      } else {
        const safeCode = code || 'GOOGLE_ACCESS_DENIED';
        const safeMsg = message || 'Google authentication was not completed.';
        const targetUrl = `/google-business?error=${encodeURIComponent(safeCode)}&message=${encodeURIComponent(safeMsg)}`;
        return `<!DOCTYPE html>
<html>
<head><title>Google Authorization Notice</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
  <div style="text-align: center; padding: 32px; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px;">
    <h3 style="color: #dc2626; margin-top: 0;">Authorization Notice</h3>
    <p style="color: #475569;">${safeMsg}</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${safeCode}', message: '${safeMsg}' }, '*');
        setTimeout(() => window.close(), 1000);
      } else {
        window.location.href = '${targetUrl}';
      }
    } catch (e) {
      window.location.href = '${targetUrl}';
    }
  </script>
</body>
</html>`;
      }
    };

    if (error || !code) {
      const rawError = String(error || 'unknown');
      const rawDesc = String(error_description || '');
      console.error('[GOOGLE CALLBACK ERROR QUERY]', { error: rawError, error_description: rawDesc });

      let safeCode = 'GOOGLE_ACCESS_DENIED';
      if (rawError.includes('access_denied')) {
        safeCode = 'GOOGLE_ACCESS_DENIED';
      } else if (rawError.includes('scope') || rawDesc.toLowerCase().includes('scope')) {
        safeCode = 'GOOGLE_SCOPE_MISSING';
      } else if (rawError.includes('unauthorized') || rawError.includes('invalid_grant')) {
        safeCode = 'GOOGLE_REAUTH_REQUIRED';
      }

      const message = rawDesc || rawError || 'Google authentication was not completed.';
      return res.send(renderCallbackHtml(false, safeCode, message));
    }

    try {
      let userId = validateGoogleOAuthState(state as string);

      if (!userId) {
        console.error('[GOOGLE CALLBACK INVALID STATE]', state);
        return res.send(renderCallbackHtml(false, 'invalid_state', 'Invalid, tampered, or expired OAuth session state.'));
      }

      const clientId = getGoogleClientId();
      const clientSecret = getGoogleClientSecret();
      const host = req.get('host');
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const redirectUri = getGoogleOAuthRedirectUri(host, protocol);

      console.log('[GOOGLE OAUTH CALLBACK REDIRECT URI]', redirectUri);

      if (!clientId || !clientSecret) {
        return res.send(renderCallbackHtml(false, 'missing_credentials', 'Google OAuth credentials not configured on backend'));
      }

      const oauth2Client = getOAuth2Client(redirectUri);
      const { tokens } = await oauth2Client.getToken(code as string);

      if (!tokens.access_token) {
        console.error('[GOOGLE TOKEN EXCHANGE FAILED]', tokens);
        return res.send(renderCallbackHtml(false, 'GOOGLE_ACCESS_DENIED', 'Token exchange failed'));
      }

      console.log('GOOGLE TOKEN SCOPES:', tokens.scope);
      console.log('HAS REFRESH TOKEN:', Boolean(tokens.refresh_token));
      console.log('ACCESS TOKEN PRESENT:', Boolean(tokens.access_token));

      // Save tokens server-side (preserves existing refresh token if Google does not return a new one, saves connectedAt)
      await saveGoogleTokens(userId, tokens);

      // Call https://mybusinessaccountmanagement.googleapis.com/v1/accounts
      // If successful: return account information.
      // If 401: refresh access token and retry once.
      // If 403: captures exact Google API error message and required scope.
      console.log(`[GOOGLE CALLBACK] Verifying Account Management API access for user ${userId}...`);
      const verification = await verifyAndFetchGoogleAccounts(userId, tokens.access_token);
      console.log('[GOOGLE CALLBACK VERIFICATION RESULT]', {
        status: verification.status,
        success: verification.success,
        accountsCount: verification.accounts?.length,
        error: verification.error
      });

      if (verification.status === 403) {
        const msg = verification.error || 'Missing required business.manage scope';
        return res.send(renderCallbackHtml(false, 'GOOGLE_ACCESS_DENIED', msg));
      }

      // Immediately synchronize owner's Google Business Profile account data:
      // 1. Accounts: Store selected googleAccountId
      // 2. Locations: Store primary location (name, address, phone, category, placeId, isPrimary)
      // 3. Reviews: Store reviews (reviewerName, starRating, comment, replyStatus, timestamp)
      try {
        console.log(`[GOOGLE CALLBACK] Initiating immediate data sync for user ${userId}...`);
        await syncGoogleDataForUser(userId);
        console.log(`[GOOGLE CALLBACK] Immediate data sync completed for user ${userId}`);
      } catch (syncErr: any) {
        console.warn(`[GOOGLE CALLBACK] Initial data sync deferred or encountered error:`, syncErr.message);
      }

      return res.send(renderCallbackHtml(true));
    } catch (err: any) {
      console.error('[GOOGLE CALLBACK EXCEPTION]', err.message);
      return res.send(renderCallbackHtml(false, 'callback_error', err.message || 'Unexpected OAuth callback error'));
    }
  };

app.get(['/api/google/callback', '/auth/google/callback', '/auth/callback'], handleGoogleOAuthCallback);


// Reusable Google Business Profile Data Synchronization Helper
export async function syncGoogleDataForUser(userId: number) {
  const token = await getValidGoogleAccessToken(userId);
  const { accounts, fromCache, rateLimited, quotaNotGranted } = await getOrFetchBusinessAccounts(userId, token, false);

  // 1. Store selected googleAccountId for user
  if (accounts && accounts.length > 0) {
    await db.update(users).set({
      selectedGoogleAccountId: accounts[0].name
    }).where(eq(users.id, userId));
  }

  let totalLocations = 0;
  let reviewsImported = 0;
  let reviewsUpdated = 0;
  let primaryLocationSaved = false;

  for (let aIdx = 0; aIdx < accounts.length; aIdx++) {
    const account = accounts[aIdx];
    const locations = await getLocations(token, account.name, userId);
    totalLocations += locations.length;

    for (let lIdx = 0; lIdx < locations.length; lIdx++) {
      const loc = locations[lIdx];
      const isPrimary = !primaryLocationSaved;
      const locationIdStr = loc.name;
      const placeId = (loc as any).metadata?.placeId || (loc as any).placeId || loc.name || null;

      const formattedAddress = loc.storefrontAddress 
        ? [loc.storefrontAddress.addressLines?.join(', '), loc.storefrontAddress.locality, loc.storefrontAddress.administrativeArea, loc.storefrontAddress.postalCode].filter(Boolean).join(', ')
        : null;

      const existingLoc = await db.select().from(businessLocations).where(and(
        eq(businessLocations.googleLocationId, locationIdStr),
        eq(businessLocations.userId, userId)
      )).limit(1);

      let dbLocId: string;
      if (existingLoc.length === 0) {
        const inserted = await db.insert(businessLocations).values({
          userId,
          googleLocationId: locationIdStr,
          googleAccountId: account.name,
          placeId,
          isPrimary,
          businessName: loc.title || 'Dhanus Gold Fitness',
          phone: loc.phoneNumbers?.primaryPhone || null,
          category: loc.categories?.primaryCategory?.displayName || null,
          websiteUri: loc.websiteUri || null,
          businessHours: loc.regularHours || null,
          description: loc.profile?.description || null,
          address: formattedAddress,
          latitude: loc.latlng?.latitude || null,
          longitude: loc.latlng?.longitude || null,
        }).returning();
        dbLocId = inserted[0].id;
      } else {
        dbLocId = existingLoc[0].id;
        await db.update(businessLocations).set({
          googleAccountId: account.name,
          placeId: placeId || existingLoc[0].placeId,
          isPrimary: isPrimary || existingLoc[0].isPrimary,
          businessName: loc.title || existingLoc[0].businessName,
          phone: loc.phoneNumbers?.primaryPhone || existingLoc[0].phone,
          category: loc.categories?.primaryCategory?.displayName || existingLoc[0].category,
          websiteUri: loc.websiteUri || existingLoc[0].websiteUri,
          businessHours: loc.regularHours || existingLoc[0].businessHours,
          description: loc.profile?.description || existingLoc[0].description,
          address: formattedAddress || existingLoc[0].address,
          latitude: loc.latlng?.latitude || existingLoc[0].latitude,
          longitude: loc.latlng?.longitude || existingLoc[0].longitude,
        }).where(eq(businessLocations.id, dbLocId));
      }

      if (isPrimary) {
        primaryLocationSaved = true;
        await db.update(users).set({
          selectedGoogleLocationId: dbLocId
        }).where(eq(users.id, userId));
      }

      // Fetch and upsert performance metrics
      try {
        const metrics = await fetchPerformanceMetrics(token, locationIdStr, userId);
        if (metrics && metrics.multiDailyMetricTimeSeries) {
          const stats: any = {
            profileViews: 0,
            searchViews: 0,
            searchesMaps: 0,
            websiteClicks: 0,
            callClicks: 0
          };
          metrics.multiDailyMetricTimeSeries.forEach((series: any) => {
            const metric = series.dailyMetric;
            const values = series.dailyMetricTimeSeries?.values || [];
            if (values.length > 0) {
              const latestValue = parseInt(values[values.length - 1].value || '0', 10);
              if (metric === 'PROFILE_VIEWS') stats.profileViews = latestValue;
              if (metric === 'SEARCH_VIEWS_SEARCH') stats.searchViews = latestValue;
              if (metric === 'SEARCH_VIEWS_MAPS') stats.searchesMaps = latestValue;
              if (metric === 'WEBSITE_CLICKS') stats.websiteClicks = latestValue;
              if (metric === 'CALL_CLICKS') stats.callClicks = latestValue;
            }
          });

          await db.insert(metricLogs).values({
            locationId: dbLocId,
            profileViews: stats.profileViews,
            searchViews: stats.searchViews,
            searchesMaps: stats.searchesMaps,
            websiteClicks: stats.websiteClicks,
            callClicks: stats.callClicks,
            recordedDate: new Date()
          });
        }
      } catch (perfErr: any) {
        console.warn(`[SYNC METRICS WARNING] ${locationIdStr}:`, perfErr.message);
      }

      // 3. Reviews: Fetch all reviews for each location
      try {
        const googleReviews = await fetchGoogleReviews(token, locationIdStr, account.name, userId);
        for (const gr of googleReviews) {
          const ratingMap: Record<string, number> = {
            'FIVE': 5,
            'FOUR': 4,
            'THREE': 3,
            'TWO': 2,
            'ONE': 1
          };
          const score = ratingMap[gr.starRating] || (parseInt(gr.starRating, 10) || 5);
          
          const existingReview = await db.select().from(reviews).where(eq(reviews.googleReviewId, gr.reviewId)).limit(1);

          if (existingReview.length === 0) {
            await db.insert(reviews).values({
              locationId: dbLocId,
              googleReviewId: gr.reviewId,
              reviewerName: gr.reviewer?.displayName || 'Anonymous',
              reviewerPhoto: gr.reviewer?.profilePhotoUrl || null,
              starRating: score,
              comment: gr.comment || null,
              replyStatus: gr.reviewReply ? 'REPLIED' : 'PENDING',
              publishedReply: gr.reviewReply?.comment || null,
              isReplied: Boolean(gr.reviewReply),
              reviewTimestamp: new Date(gr.createTime),
              needsAttention: score <= 2,
              lastSyncedAt: new Date(),
            });
            reviewsImported++;
          } else {
            await db.update(reviews).set({
              reviewerName: gr.reviewer?.displayName || existingReview[0].reviewerName,
              reviewerPhoto: gr.reviewer?.profilePhotoUrl || existingReview[0].reviewerPhoto,
              starRating: score,
              comment: gr.comment || existingReview[0].comment,
              publishedReply: gr.reviewReply?.comment || existingReview[0].publishedReply,
              replyStatus: gr.reviewReply ? 'REPLIED' : existingReview[0].replyStatus,
              isReplied: Boolean(gr.reviewReply || existingReview[0].isReplied),
              reviewTimestamp: new Date(gr.createTime),
              needsAttention: score <= 2,
              lastSyncedAt: new Date(),
            }).where(eq(reviews.id, existingReview[0].id));
            reviewsUpdated++;
          }
        }
      } catch (revErr: any) {
        console.warn(`[SYNC REVIEWS WARNING] ${locationIdStr}:`, revErr.message);
      }
    }
  }

  const now = new Date();
  await db.update(users).set({ googleLastSyncedAt: now }).where(eq(users.id, userId));

  return {
    accounts: accounts.length,
    locations: totalLocations,
    reviewsImported,
    reviewsUpdated,
    fromCache,
    rateLimited: !!rateLimited,
    quotaNotGranted: !!quotaNotGranted,
  };
}


// Google Disconnect Endpoint
app.post('/api/google/disconnect', requireAuth, async (req: AuthRequest, res) => {
  try {
    await disconnectGoogleTokens(req.dbUser.id);
    setUserApiAccessState(req.dbUser.id, 'unknown', null);
    res.json({ success: true, message: 'Google Business Profile disconnected successfully' });
  } catch (error: any) {
    console.error('[GOOGLE DISCONNECT ERROR]', error.message);
    res.status(500).json({ success: false, code: 'DISCONNECT_FAILED', message: 'Failed to disconnect Google account' });
  }
});

app.post('/api/auth/google-tokens', requireAuth, async (req: AuthRequest, res) => {
  return res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated and disabled to protect Business Profile OAuth tokens.'
  });
});

// Enforce ownership for simple reads

app.get('/api/seo/keywords', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await db.select({
      id: seoKeywords.id,
      keyword: seoKeywords.keyword,
      currentRank: seoKeywords.currentRank,
      searchVolume: seoKeywords.searchVolume,
      locationId: seoKeywords.locationId
    }).from(seoKeywords)
      .innerJoin(businessLocations, eq(seoKeywords.locationId, businessLocations.id))
      .where(eq(businessLocations.userId, req.dbUser.id));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

app.get('/api/competitors', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await db.select({
      id: competitors.id,
      businessName: competitors.businessName,
      googleMapsUrl: competitors.googleMapsUrl,
      currentRank: competitors.currentRank,
      rating: competitors.rating,
      reviewCount: competitors.reviewCount
    }).from(competitors)
      .innerJoin(businessLocations, eq(competitors.locationId, businessLocations.id))
      .where(eq(businessLocations.userId, req.dbUser.id));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competitors' });
  }
});

app.get('/api/citations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await db.select({
      id: citationSources.id,
      platform: citationSources.platform,
      listingUrl: citationSources.listingUrl,
      syncStatus: citationSources.syncStatus
    }).from(citationSources)
      .innerJoin(businessLocations, eq(citationSources.locationId, businessLocations.id))
      .where(eq(businessLocations.userId, req.dbUser.id));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch citations' });
  }
});

app.get('/api/campaigns', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await db.select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      status: campaigns.status,
      messageTemplate: campaigns.messageTemplate
    }).from(campaigns)
      .innerJoin(businessLocations, eq(campaigns.locationId, businessLocations.id))
      .where(eq(businessLocations.userId, req.dbUser.id));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

app.post(['/api/sync', '/api/google/sync'], requireAuth, async (req: AuthRequest, res) => {
  console.log('[SYNC USER]', {
    firebaseUid: req.dbUser?.uid,
    dbUserId: req.dbUser?.id,
    hasGoogleAccessToken: Boolean(req.dbUser?.googleAccessToken),
    hasGoogleRefreshToken: Boolean(req.dbUser?.googleRefreshToken),
    googleConnectedAt: req.dbUser?.googleConnectedAt
  });

  try {
    const syncResult = await syncGoogleDataForUser(req.dbUser.id);
    res.json({
      success: true,
      ...syncResult,
      syncedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[SYNC ERROR]', {
      code: error.code,
      message: error.message,
      status: error.status
    });
    
    // Treat Quota 429 as CONNECTED_API_PENDING, never as disconnected
    if (error.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || error.code === 'QUOTA_TEMPORARILY_EXCEEDED' || error.code === 'GOOGLE_RATE_LIMITED' || error.status === 429) {
      return res.status(429).json({
        success: false,
        code: 'GOOGLE_API_QUOTA_PENDING',
        message: 'Google Business Profile is connected, but API access/quota is currently pending.'
      });
    }

    if (error.code === 'GOOGLE_NOT_CONNECTED') {
      return res.status(401).json({
        success: false,
        code: 'GOOGLE_NOT_CONNECTED',
        message: 'Connect Google Business Profile first.'
      });
    }

    if (error.code === 'GOOGLE_REAUTH_REQUIRED') {
      return res.status(401).json({
        success: false,
        code: 'GOOGLE_REAUTH_REQUIRED',
        message: 'Google authorization has expired. Please reconnect your Google account.'
      });
    }

    let statusCode = error.status || 500;
    if (error.code === 'GOOGLE_SCOPE_MISSING' || error.code === 'GOOGLE_API_ACCESS_DENIED' || error.code === 'GOOGLE_ACCESS_DENIED' || error.status === 403) {
      try {
        const localLocs = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id));
        if (localLocs.length > 0) {
          const now = new Date();
          await db.update(users).set({ googleLastSyncedAt: now }).where(eq(users.id, req.dbUser.id));
          return res.json({
            success: true,
            accounts: 1,
            locations: localLocs.length,
            reviewsImported: 0,
            reviewsUpdated: 0,
            fromCache: true,
            scopeMissing: true,
            syncedAt: now.toISOString(),
            message: 'Serving cached local business profile data. (Google Business Profile scope authorization pending)'
          });
        }
      } catch (locErr) {
        console.warn('[SYNC CACHE FALLBACK ERROR]', locErr);
      }
      statusCode = 403;
    }

    res.status(statusCode).json({ 
      success: false, 
      code: error.code || 'SYNC_FAILED', 
      message: error.message || 'Sync failed',
      retryAfter: error.retryAfter || null
    });
  }
});

app.get('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const allReviews = await db.select({
      id: reviews.id,
      reviewerName: reviews.reviewerName,
      starRating: reviews.starRating,
      comment: reviews.comment,
      replyStatus: reviews.replyStatus,
      publishedReply: reviews.publishedReply,
      reviewTimestamp: reviews.reviewTimestamp,
      googleReviewId: reviews.googleReviewId,
      locationId: reviews.locationId,
      businessName: businessLocations.businessName,
      googleAccountId: businessLocations.googleAccountId,
      googleLocationId: businessLocations.googleLocationId,
      aiDraftReply: reviews.aiDraftReply,
      needsAttention: reviews.needsAttention
    })
    .from(reviews)
    .innerJoin(businessLocations, eq(reviews.locationId, businessLocations.id))
    .where(eq(businessLocations.userId, req.dbUser.id))
    .orderBy(desc(reviews.reviewTimestamp));
    
    res.json(allReviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.get('/api/seo/keyword-suggestions', requireAuth, async (req: AuthRequest, res) => {
  res.json([
    { keyword: 'local business near me', volume: 1200, difficulty: 'Medium' },
    { keyword: 'best reviews in city', volume: 850, difficulty: 'High' },
    { keyword: 'nearby professional services', volume: 450, difficulty: 'Low' }
  ]);
});

app.get('/api/reports/performance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await db.select().from(metricLogs)
      .innerJoin(businessLocations, eq(metricLogs.locationId, businessLocations.id))
      .where(eq(businessLocations.userId, req.dbUser.id))
      .orderBy(desc(metricLogs.recordedDate));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

async function getOrCreateCreditAccount(userId: number) {
  let account = await db.select().from(aiCreditAccounts).where(eq(aiCreditAccounts.userId, userId)).limit(1);
  if (account.length === 0) {
    const newAccount = await db.insert(aiCreditAccounts).values({
      userId,
      creditsRemaining: 10,
      monthlyAllowance: 10
    }).returning();
    return newAccount[0];
  }
  return account[0];
}

async function deductCredits(userId: number, amount: number, feature: string, description: string) {
  const account = await getOrCreateCreditAccount(userId);
  if (account.creditsRemaining < amount) {
    const error = new Error('You have no AI credits remaining.') as any;
    error.code = 'AI_CREDITS_EXHAUSTED';
    error.status = 402;
    throw error;
  }

  await db.update(aiCreditAccounts)
    .set({ 
      creditsRemaining: account.creditsRemaining - amount,
      updatedAt: new Date()
    })
    .where(eq(aiCreditAccounts.userId, userId));

  await db.insert(aiCreditTransactions).values({
    userId,
    type: 'DEBIT',
    credits: amount,
    feature,
    description
  });

  return account.creditsRemaining - amount;
}

app.post('/api/reviews/:id/generate-reply', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(409).json({
        success: false,
        code: 'GEMINI_CONFIGURATION_REQUIRED',
        message: 'Configure Gemini API access to use AI generation features.'
      });
    }

    const { tone, language } = req.body;
    const reviewIdStr = req.params.id as string;

    if (!reviewIdStr) {
      return res.status(400).json({ success: false, message: 'Review ID is required' });
    }

    // Deduct 1 credit
    await deductCredits(req.dbUser.id, 1, 'REVIEW_REPLY', `AI Reply for review ${reviewIdStr}`);

    // Load review
    const reviewResult = await db.select({
      id: reviews.id,
      comment: reviews.comment,
      starRating: reviews.starRating,
      reviewerName: reviews.reviewerName,
      businessName: businessLocations.businessName
    }).from(reviews)
      .innerJoin(businessLocations, eq(reviews.locationId, businessLocations.id))
      .where(and(eq(reviews.id, reviewIdStr), eq(businessLocations.userId, req.dbUser.id)))
      .limit(1);

    if (reviewResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const review = reviewResult[0];

    try {
      const reply = await generateReviewReply({
        reviewerName: review.reviewerName, 
        rating: review.starRating, 
        comment: review.comment || '', 
        language: language || 'English', 
        businessName: review.businessName || 'our business'
      });

      await db.update(reviews).set({ aiDraftReply: reply }).where(eq(reviews.id, review.id));

      res.json({ success: true, reply });
    } catch (genError: any) {
      console.error('[GEMINI ERROR]', {
        route: req.path,
        message: genError.message,
        status: genError.status || 500
      });

      if (genError.message?.includes('429') || genError.status === 429) {
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMITED',
          message: 'This service has reached its current request or quota limit.'
        });
      }
      throw genError;
    }
  } catch (error: any) {
    console.error('[REVIEW REPLY GEN ERROR]', {
      route: req.path,
      code: error.code,
      message: error.message
    });

    if (error.code === 'AI_CREDITS_EXHAUSTED') {
      return res.status(error.status || 402).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    res.status(500).json({ success: false, message: error.message || 'Failed to generate reply' });
  }
});

app.post('/api/reviews/:id/publish', requireAuth, async (req: AuthRequest, res) => {
  try {
    const reviewIdStr = req.params.id as string;
    const { replyText } = req.body;

    if (!reviewIdStr) {
      return res.status(400).json({ success: false, message: 'Review ID is required' });
    }

    if (!replyText || !replyText.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text cannot be empty' });
    }

    const reviewResult = await db.select({
      id: reviews.id,
      googleReviewId: reviews.googleReviewId,
      googleLocationId: businessLocations.googleLocationId,
      googleAccountId: businessLocations.googleAccountId,
    }).from(reviews)
      .innerJoin(businessLocations, eq(reviews.locationId, businessLocations.id))
      .where(and(eq(reviews.id, reviewIdStr), eq(businessLocations.userId, req.dbUser.id)))
      .limit(1);

    if (reviewResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found or unauthorized' });
    }
    
    const review = reviewResult[0];

    if (!review.googleReviewId) {
      return res.status(400).json({ success: false, message: 'Review is not linked to a Google Business Profile review' });
    }

    const token = await getValidGoogleAccessToken(req.dbUser.id);
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        code: 'GOOGLE_NOT_CONNECTED', 
        message: 'Connect Google Business Profile first' 
      });
    }

    // Call external Google API
    await replyToGoogleReview(
      token, 
      review.googleLocationId, 
      review.googleReviewId, 
      replyText.trim(),
      review.googleAccountId || undefined
    );

    // Only update DB after Google succeeds
    await db.update(reviews)
      .set({
        replyStatus: 'REPLIED',
        publishedReply: replyText.trim(),
        aiDraftReply: null,
        isReplied: true,
      })
      .where(eq(reviews.id, review.id));

    res.json({ success: true, message: 'Reply published to Google successfully' });
  } catch (error: any) {
    console.error('[PUBLISH REPLY ERROR]', {
      code: error.code,
      message: error.message
    });
    const statusCode = error.status || (error.code === 'GOOGLE_REAUTH_REQUIRED' ? 401 : error.code === 'GOOGLE_SCOPE_MISSING' || error.code === 'GOOGLE_API_ACCESS_DENIED' ? 403 : 500);
    res.status(statusCode).json({ 
      success: false, 
      code: error.code || 'PUBLISH_FAILED', 
      message: error.message || 'Failed to publish reply to Google' 
    });
  }
});

app.get('/api/locations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const locations = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id));
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

app.get('/api/social-accounts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const accounts = await db.select().from(socialAccounts).where(eq(socialAccounts.userId, req.dbUser.id));
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

app.post('/api/social-accounts/connect', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { platformName, accessToken, profileId, profileName } = req.body;
    const account = await db.insert(socialAccounts).values({
      userId: req.dbUser.id,
      platformName,
      accessToken,
      profileId,
      profileName
    }).returning();
    res.json(account[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect social account' });
  }
});

app.delete('/api/social-accounts/disconnect/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(socialAccounts).where(and(eq(socialAccounts.id, parseInt(req.params.id as string)), eq(socialAccounts.userId, req.dbUser.id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect social account' });
  }
});

app.post('/api/business-profile/update', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { locationId, businessName, phone, websiteUri, description, category, businessHours } = req.body;

    const updates: any = {};
    if (businessName !== undefined) updates.businessName = businessName;
    if (category !== undefined) updates.category = category || null;
    if (phone !== undefined) updates.phone = phone || null;
    if (websiteUri !== undefined) updates.websiteUri = websiteUri || null;
    if (businessHours !== undefined) updates.businessHours = businessHours || null;
    if (description !== undefined) updates.description = description || null;

    if (locationId && typeof locationId === 'string' && locationId.length > 5) {
      const updated = await db.update(businessLocations)
        .set(updates)
        .where(and(eq(businessLocations.id, locationId), eq(businessLocations.userId, req.dbUser.id)))
        .returning();
      
      if (updated.length > 0) {
        return res.json(updated[0]);
      }
    }

    // If no locationId or not found by id, update first user location
    const existing = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id)).limit(1);
    if (existing.length > 0) {
      const updated = await db.update(businessLocations)
        .set(updates)
        .where(eq(businessLocations.id, existing[0].id))
        .returning();
      return res.json(updated[0]);
    } else {
      return res.status(404).json({
        error: 'No Google Business location found. Connect your Google Business Profile and sync locations first.',
        code: 'NO_LOCATION_FOUND'
      });
    }
  } catch (error: any) {
    console.error('[BUSINESS LOCATION UPDATE]', {
      message: error instanceof Error ? error.message : error,
      cause: error?.cause || error
    });
    res.status(500).json({ error: 'Failed to update business profile' });
  }
});

app.get('/api/posts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const posts = await db.select({
      id: scheduledPosts.id,
      content: scheduledPosts.content,
      imageUrl: scheduledPosts.imageUrl,
      platforms: scheduledPosts.platforms,
      scheduledFor: scheduledPosts.scheduledFor,
      status: scheduledPosts.status,
      errorMessage: scheduledPosts.errorMessage,
      locationId: scheduledPosts.locationId,
      businessName: businessLocations.businessName
    })
    .from(scheduledPosts)
    .innerJoin(businessLocations, eq(scheduledPosts.locationId, businessLocations.id))
    .where(eq(businessLocations.userId, req.dbUser.id))
    .orderBy(desc(scheduledPosts.scheduledFor));
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts/generate-caption', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(409).json({
        success: false,
        code: 'GEMINI_CONFIGURATION_REQUIRED',
        message: 'Configure Gemini API access to use AI generation features.'
      });
    }

    const { topic, tone = 'professional', language = 'English' } = req.body;
    
    // Deduct 2 credits for post generation
    await deductCredits(req.dbUser.id, 2, 'POST_GENERATION', `AI Caption for: ${topic.substring(0, 30)}...`);

    try {
      const caption = await generatePostCaption({ topic, tone, language });
      res.json({ caption });
    } catch (genError: any) {
      console.error('[GEMINI ERROR]', {
        route: req.path,
        message: genError.message,
        status: genError.status || 500
      });

      if (genError.message?.includes('429') || genError.status === 429) {
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMITED',
          message: 'This service has reached its current request or quota limit.'
        });
      }
      throw genError;
    }
  } catch (error: any) {
    console.error('[POST CAPTION GEN ERROR]', {
      route: req.path,
      code: error.code,
      message: error.message
    });

    if (error.code === 'AI_CREDITS_EXHAUSTED') {
      return res.status(error.status || 402).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    res.status(500).json({ error: error.message || 'Generation failed' });
  }
});

app.post('/api/posts/publish-now', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { summary, mediaUrl, locationId, callToAction } = req.body;
    
    if (!locationId) {
      return res.status(400).json({ success: false, message: 'Location ID is required' });
    }

    if (!summary || !summary.trim()) {
      return res.status(400).json({ success: false, message: 'Post content cannot be empty' });
    }

    // Verify ownership
    const loc = await db.select().from(businessLocations).where(and(
      eq(businessLocations.id, locationId),
      eq(businessLocations.userId, req.dbUser.id)
    )).limit(1);

    if (loc.length === 0) {
      return res.status(404).json({ success: false, message: 'Location not found or unauthorized' });
    }

    const token = await getValidGoogleAccessToken(req.dbUser.id);
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        code: 'GOOGLE_NOT_CONNECTED', 
        message: 'Connect Google Business Profile first' 
      });
    }

    // Call external Google API
    const result = await createGooglePost(
      token, 
      loc[0].googleLocationId, 
      summary.trim(), 
      mediaUrl || undefined,
      callToAction,
      loc[0].googleAccountId || undefined
    );

    // Save to DB as PUBLISHED only after Google confirms
    const post = await db.insert(scheduledPosts).values({
      content: summary.trim(),
      imageUrl: mediaUrl || null,
      platforms: ['google'],
      scheduledFor: new Date(),
      locationId,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      googlePostId: result?.name || null,
    }).returning();

    res.json({ success: true, post: post[0] });
  } catch (error: any) {
    console.error('[PUBLISH NOW POST ERROR]', {
      code: error.code,
      message: error.message
    });
    const statusCode = error.status || (error.code === 'GOOGLE_REAUTH_REQUIRED' ? 401 : error.code === 'GOOGLE_SCOPE_MISSING' || error.code === 'GOOGLE_API_ACCESS_DENIED' ? 403 : 500);
    res.status(statusCode).json({ 
      success: false, 
      code: error.code || 'POST_PUBLISH_FAILED', 
      message: error.message || 'Failed to publish post to Google' 
    });
  }
});

app.post('/api/posts/schedule', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { summary, mediaUrl, scheduledFor, locationId, platforms } = req.body;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Location ID is required' });
    }

    if (!summary || !summary.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    // Verify ownership
    const loc = await db.select().from(businessLocations).where(and(eq(businessLocations.id, locationId), eq(businessLocations.userId, req.dbUser.id))).limit(1);
    if (loc.length === 0) return res.status(403).json({ error: 'Unauthorized location' });

    const post = await db.insert(scheduledPosts).values({
      content: summary.trim(),
      imageUrl: mediaUrl || null,
      platforms: platforms || ['google'],
      scheduledFor: new Date(scheduledFor),
      locationId,
      status: 'PENDING'
    }).returning();
    res.json(post[0]);
  } catch (error) {
    res.status(500).json({ error: 'Scheduling failed' });
  }
});

// --- SETTINGS ENDPOINTS ---

// GET /api/settings - Loads real user and business settings
app.get('/api/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    
    // 1. Fetch persistent appSettings
    const savedSettingRecord = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'general_settings'))
    ).limit(1);

    const saved = (savedSettingRecord[0]?.value as any) || {};

    // 2. Fetch primary business location (if exists)
    const locations = await db.select().from(businessLocations).where(eq(businessLocations.userId, userId)).limit(1);
    const loc = locations[0] || ({} as any);

    // 3. User details
    const dbUser = req.dbUser;

    const settings = {
      businessName: saved.businessName ?? loc.businessName ?? 'Dhanus Gold Fitness',
      email: saved.email ?? (loc.phone ? saved.email || '' : dbUser.email || ''),
      phone: saved.phone ?? loc.phone ?? '+91 98765 43210',
      website: saved.website ?? loc.websiteUri ?? '',
      address: saved.address ?? loc.address ?? '',
      city: saved.city ?? '',
      state: saved.state ?? '',
      postalCode: saved.postalCode ?? '',
      country: saved.country ?? 'India',
      timezone: saved.timezone || 'Asia/Kolkata',
      currency: saved.currency || 'INR',
      language: saved.language || 'en',
      description: saved.description ?? loc.description ?? '',
      ownerName: saved.ownerName ?? dbUser.name ?? '',
      ownerEmail: dbUser.email ?? '',
      ownerPhone: saved.ownerPhone ?? '',
      avatarUrl: saved.avatarUrl ?? dbUser.avatarUrl ?? ''
    };

    res.json({
      success: true,
      settings
    });
  } catch (error: any) {
    console.error('[GET SETTINGS ERROR]', error.message);
    res.status(500).json({
      success: false,
      code: 'SETTINGS_LOAD_FAILED',
      message: 'Failed to load settings'
    });
  }
});

// PUT /api/settings - Saves and persists user and business settings
app.put('/api/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const body = { ...(req.body || {}) };

    // Explicitly reject prohibited/security sensitive keys
    const prohibitedKeys = ['id', 'user_id', 'userId', 'firebase_uid', 'uid', 'role', 'admin', 'credits', 'subscription_status', 'planId', 'googleAccessToken', 'googleRefreshToken'];
    for (const key of prohibitedKeys) {
      if (key in body) {
        delete body[key];
      }
    }

    const {
      businessName,
      email,
      phone,
      website,
      address,
      city,
      state,
      postalCode,
      country,
      timezone,
      currency,
      language,
      description,
      ownerName,
      ownerPhone,
      avatarUrl
    } = body;

    // Validation
    const validationErrors: Record<string, string> = {};

    if (businessName !== undefined && typeof businessName === 'string') {
      if (businessName.trim().length > 200) {
        validationErrors.businessName = 'Business name must not exceed 200 characters';
      }
    }

    if (email && typeof email === 'string' && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        validationErrors.email = 'Invalid email address format';
      } else if (email.length > 150) {
        validationErrors.email = 'Email must not exceed 150 characters';
      }
    }

    if (website && typeof website === 'string' && website.trim() !== '') {
      try {
        const urlToTest = website.startsWith('http://') || website.startsWith('https://') ? website : `https://${website}`;
        new URL(urlToTest);
      } catch {
        validationErrors.website = 'Invalid website URL format';
      }
      if (website.length > 255) {
        validationErrors.website = 'Website URL must not exceed 255 characters';
      }
    }

    if (phone && typeof phone === 'string' && phone.length > 50) {
      validationErrors.phone = 'Phone number must not exceed 50 characters';
    }

    if (description && typeof description === 'string' && description.length > 2000) {
      validationErrors.description = 'Description must not exceed 2000 characters';
    }

    if (ownerName && typeof ownerName === 'string' && ownerName.length > 100) {
      validationErrors.ownerName = 'Owner name must not exceed 100 characters';
    }

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed on submitted settings',
        errors: validationErrors
      });
    }

    // Prepare clean payload
    const cleanSettings: Record<string, any> = {
      businessName: typeof businessName === 'string' ? businessName.trim() : undefined,
      email: typeof email === 'string' ? email.trim() : undefined,
      phone: typeof phone === 'string' ? phone.trim() : undefined,
      website: typeof website === 'string' ? website.trim() : undefined,
      address: typeof address === 'string' ? address.trim() : undefined,
      city: typeof city === 'string' ? city.trim() : undefined,
      state: typeof state === 'string' ? state.trim() : undefined,
      postalCode: typeof postalCode === 'string' ? postalCode.trim() : undefined,
      country: typeof country === 'string' && country.trim() ? country.trim() : 'India',
      timezone: typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'Asia/Kolkata',
      currency: typeof currency === 'string' && currency.trim() ? currency.trim() : 'INR',
      language: typeof language === 'string' && language.trim() ? language.trim() : 'en',
      description: typeof description === 'string' ? description.trim() : undefined,
      ownerName: typeof ownerName === 'string' ? ownerName.trim() : undefined,
      ownerPhone: typeof ownerPhone === 'string' ? ownerPhone.trim() : undefined,
      avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : undefined
    };

    // Remove undefined values
    for (const key of Object.keys(cleanSettings)) {
      if (cleanSettings[key] === undefined) {
        delete cleanSettings[key];
      }
    }

    // Load existing settings to merge
    const existing = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'general_settings'))
    ).limit(1);

    const mergedValue = {
      ...((existing[0]?.value as any) || {}),
      ...cleanSettings,
      updatedAt: new Date().toISOString()
    };

    if (existing.length === 0) {
      await db.insert(appSettings).values({
        userId,
        key: 'general_settings',
        value: mergedValue,
        updatedAt: new Date()
      });
    } else {
      await db.update(appSettings).set({
        value: mergedValue,
        updatedAt: new Date()
      }).where(eq(appSettings.id, existing[0].id));
    }

    // Update users table for owner name/avatar
    const userUpdates: any = {};
    if (cleanSettings.ownerName !== undefined) userUpdates.name = cleanSettings.ownerName;
    if (cleanSettings.avatarUrl !== undefined) userUpdates.avatarUrl = cleanSettings.avatarUrl;
    if (Object.keys(userUpdates).length > 0) {
      await db.update(users).set(userUpdates).where(eq(users.id, userId));
    }

    // Update local businessLocations primary record so the rest of app reflects it
    const userLocs = await db.select().from(businessLocations).where(eq(businessLocations.userId, userId));
    if (userLocs.length > 0) {
      const locUpdates: any = {};
      if (cleanSettings.businessName) locUpdates.businessName = cleanSettings.businessName;
      if (cleanSettings.phone) locUpdates.phone = cleanSettings.phone;
      if (cleanSettings.website) locUpdates.websiteUri = cleanSettings.website;
      if (cleanSettings.address) locUpdates.address = cleanSettings.address;
      if (cleanSettings.description) locUpdates.description = cleanSettings.description;
      if (Object.keys(locUpdates).length > 0) {
        await db.update(businessLocations).set(locUpdates).where(eq(businessLocations.id, userLocs[0].id));
      }
    }

    res.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        ...mergedValue,
        ownerEmail: req.dbUser.email || ''
      }
    });
  } catch (error: any) {
    console.error('[SAVE SETTINGS ERROR]', error.message);
    res.status(500).json({
      success: false,
      code: 'SETTINGS_UPDATE_FAILED',
      message: 'Failed to save settings'
    });
  }
});

// GET /api/settings/notifications - Loads notification preferences
app.get('/api/settings/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const record = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, req.dbUser.id), eq(appSettings.key, 'notification_settings'))
    ).limit(1);

    const defaultNotifs = {
      emailReviews: true,
      negativeReviewAlerts: true,
      weeklyDigest: true,
      aiSuggestions: true,
      whatsappAlerts: false,
      systemUpdates: true
    };

    const notifSettings = record[0]?.value ? { ...defaultNotifs, ...(record[0].value as any) } : defaultNotifs;

    res.json({ success: true, notifications: notifSettings });
  } catch (error: any) {
    res.status(500).json({ success: false, code: 'NOTIFICATIONS_LOAD_FAILED', message: 'Failed to load notifications' });
  }
});

// PUT /api/settings/notifications - Saves notification preferences
app.put('/api/settings/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const payload = req.body || {};
    const existing = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, req.dbUser.id), eq(appSettings.key, 'notification_settings'))
    ).limit(1);

    const merged = {
      emailReviews: !!payload.emailReviews,
      negativeReviewAlerts: !!payload.negativeReviewAlerts,
      weeklyDigest: !!payload.weeklyDigest,
      aiSuggestions: !!payload.aiSuggestions,
      whatsappAlerts: !!payload.whatsappAlerts,
      systemUpdates: !!payload.systemUpdates,
      updatedAt: new Date().toISOString()
    };

    if (existing.length === 0) {
      await db.insert(appSettings).values({
        userId: req.dbUser.id,
        key: 'notification_settings',
        value: merged,
        updatedAt: new Date()
      });
    } else {
      await db.update(appSettings).set({
        value: merged,
        updatedAt: new Date()
      }).where(eq(appSettings.id, existing[0].id));
    }

    res.json({ success: true, message: 'Notification preferences saved successfully', notifications: merged });
  } catch (error: any) {
    res.status(500).json({ success: false, code: 'NOTIFICATIONS_UPDATE_FAILED', message: 'Failed to save notifications' });
  }
});

// GET /api/settings/security - Loads security and session information
app.get('/api/settings/security', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    res.json({
      success: true,
      security: {
        uid: req.user?.uid || user[0]?.uid,
        email: req.user?.email || user[0]?.email,
        emailVerified: !!(req.user?.email_verified),
        provider: req.user?.firebase?.sign_in_provider || 'password',
        createdAt: user[0]?.createdAt,
        googleLinked: !!user[0]?.googleAccessToken,
        googleScopes: user[0]?.googleScopes || null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, code: 'SECURITY_LOAD_FAILED', message: 'Failed to load security info' });
  }
});

// GET /api/settings/integrations - Loads detailed integration statuses (0 external Google calls)
app.get('/api/settings/integrations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    const cachedAccounts = await db.select().from(googleBusinessAccounts).where(eq(googleBusinessAccounts.userId, req.dbUser.id));
    const cachedLocations = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id));
    const cooldown = isAccountInCooldown(req.dbUser.id, 'mybusinessaccountmanagement.googleapis.com');
    const recordedApiState = getUserApiAccessState(req.dbUser.id);
    const hasOAuthToken = Boolean(user[0]?.googleAccessToken || user[0]?.googleRefreshToken);

    let status: 'NOT_CONNECTED' | 'CONNECTED_API_PENDING' | 'CONNECTED_READY' = 'NOT_CONNECTED';
    let apiAccess: 'ready' | 'pending' | 'unknown' = 'unknown';

    if (!hasOAuthToken) {
      status = 'NOT_CONNECTED';
      apiAccess = 'unknown';
    } else if (cooldown.quotaNotGranted || cooldown.inCooldown || recordedApiState?.state === 'pending' || recordedApiState?.state === 'scope_missing' || recordedApiState?.state === 'access_denied') {
      status = 'CONNECTED_API_PENDING';
      apiAccess = 'pending';
    } else if (recordedApiState?.state === 'ready' || user[0]?.googleLastSyncedAt || cachedAccounts.length > 0 || cachedLocations.length > 0) {
      status = 'CONNECTED_READY';
      apiAccess = 'ready';
    } else {
      status = 'CONNECTED_API_PENDING';
      apiAccess = 'pending';
    }

    res.json({
      success: true,
      google: {
        configured: isGoogleOAuthConfigured(),
        oauthConnected: hasOAuthToken,
        connected: hasOAuthToken,
        status,
        apiAccess,
        quotaNotGranted: cooldown.quotaNotGranted,
        rateLimited: cooldown.inCooldown,
        cooldownSeconds: cooldown.remainingSeconds,
        accountsCount: cachedAccounts.length,
        locationsCount: cachedLocations.length,
        lastSyncedAt: user[0]?.googleLastSyncedAt || null
      },
      gemini: {
        configured: !!process.env.GEMINI_API_KEY,
        status: process.env.GEMINI_API_KEY ? 'ACTIVE' : 'CONFIGURATION_REQUIRED'
      },
      rankingProvider: {
        configured: true,
        status: 'ACTIVE'
      },
      whatsapp: {
        configured: !!process.env.WHATSAPP_ACCESS_TOKEN,
        status: process.env.WHATSAPP_ACCESS_TOKEN ? 'ACTIVE' : 'CONFIGURATION_REQUIRED'
      },
      database: {
        configured: true,
        status: 'CONNECTED',
        provider: 'PostgreSQL'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, code: 'INTEGRATIONS_LOAD_FAILED', message: 'Failed to load integrations' });
  }
});

app.get('/api/dashboard/summary', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const userId = req.dbUser.id;
    console.log('[DASHBOARD] loading locations for user:', userId);

    let locations: any[] = [];
    try {
      locations = await db.select().from(businessLocations).where(eq(businessLocations.userId, userId));
      console.log('[DASHBOARD] locations loaded:', locations.length);
    } catch (locErr: any) {
      console.error('[DASHBOARD] failed loading locations:', locErr instanceof Error ? locErr.message : locErr);
      locations = [];
    }

    let user: any = req.dbUser || null;
    try {
      const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (userRecord && userRecord.length > 0) {
        user = userRecord[0];
      }
    } catch (uErr: any) {
      console.warn('[DASHBOARD] fallback user used, DB user query failed:', uErr instanceof Error ? uErr.message : uErr);
    }
    const hasOAuthToken = Boolean(user?.googleAccessToken || user?.googleRefreshToken);
    const cooldown = isAccountInCooldown(userId);
    const recordedApiState = getUserApiAccessState(userId);

    let googleStatusState: 'NOT_CONNECTED' | 'CONNECTED_API_PENDING' | 'CONNECTED_READY' = 'NOT_CONNECTED';
    let googleApiAccess: 'ready' | 'pending' | 'unknown' = 'unknown';

    if (!hasOAuthToken) {
      googleStatusState = 'NOT_CONNECTED';
      googleApiAccess = 'unknown';
    } else if (cooldown.quotaNotGranted || cooldown.inCooldown || recordedApiState?.state === 'pending' || recordedApiState?.state === 'scope_missing' || recordedApiState?.state === 'access_denied') {
      googleStatusState = 'CONNECTED_API_PENDING';
      googleApiAccess = 'pending';
    } else if (recordedApiState?.state === 'ready' || user?.googleLastSyncedAt || locations.length > 0) {
      googleStatusState = 'CONNECTED_READY';
      googleApiAccess = 'ready';
    } else {
      googleStatusState = 'CONNECTED_API_PENDING';
      googleApiAccess = 'pending';
    }

    // AI Credits
    console.log('[DASHBOARD] loading ai credits');
    let creditAccount = { creditsRemaining: 10 };
    try {
      creditAccount = await getOrCreateCreditAccount(userId);
      console.log('[DASHBOARD] credits loaded:', creditAccount.creditsRemaining);
    } catch (credErr: any) {
      console.error('[DASHBOARD] failed loading credits:', credErr instanceof Error ? credErr.message : credErr);
    }

    if (locations.length === 0) {
      console.log('[DASHBOARD] no locations found, returning clean empty state');
      return res.json({ 
        success: true,
        google: {
          oauthConnected: hasOAuthToken,
          connected: hasOAuthToken,
          status: googleStatusState,
          apiAccess: googleApiAccess,
          accounts: 0,
          locations: 0,
          quotaNotGranted: cooldown.quotaNotGranted,
          rateLimited: cooldown.inCooldown
        },
        user: {
          email: req.user?.email || req.dbUser.email,
          emailVerified: !!(req.user?.email_verified),
          name: req.dbUser.name || ''
        },
        ai: { creditsRemaining: creditAccount.creditsRemaining ?? 10 },
        reviews: { total: 0, averageRating: 0, unanswered: 0, positive: 0, neutral: 0, negative: 0 },
        competitors: { tracked: 0, totalReviews: 0, averageRating: 0, photos: null },
        profileAudit: { score: 0, status: "Needs Attention" },
        performance: { profileViews: 0, searches: 0, websiteClicks: 0, calls: 0, directions: 0 },
        rankings: { tracked: 0, top3: 0, top10: 0, improved: 0, declined: 0 },
        recentReviews: [],
        recentPosts: [],
        optimizationTasks: []
      });
    }

    const loc = locations[0];

    // Reviews
    console.log('[DASHBOARD] loading reviews');
    let allReviews: any[] = [];
    try {
      allReviews = await db.select().from(reviews).where(eq(reviews.locationId, loc.id)).orderBy(desc(reviews.reviewTimestamp));
      console.log('[DASHBOARD] reviews loaded:', allReviews.length);
    } catch (revErr: any) {
      console.error('[DASHBOARD] failed loading reviews:', revErr instanceof Error ? revErr.message : revErr);
    }
    const total = allReviews.length;
    const unanswered = allReviews.filter(r => r.replyStatus === 'PENDING').length;
    const negative = allReviews.filter(r => r.starRating <= 2).length;
    const positive = allReviews.filter(r => r.starRating >= 4).length;
    const neutral = Math.max(0, total - positive - negative);
    const ratingSum = allReviews.reduce((sum, r) => sum + (r.starRating || 0), 0);
    const avgRating = total > 0 ? (ratingSum / total).toFixed(1) : 0;

    // Competitors
    console.log('[DASHBOARD] loading competitors');
    let allCompetitors: any[] = [];
    try {
      allCompetitors = await db.select().from(competitors).where(eq(competitors.locationId, loc.id));
      console.log('[DASHBOARD] competitors loaded:', allCompetitors.length);
    } catch (compErr: any) {
      console.error('[DASHBOARD] failed loading competitors:', compErr instanceof Error ? compErr.message : compErr);
    }
    const compTotalReviews = allCompetitors.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
    const compAvgRating = allCompetitors.length > 0 ? (allCompetitors.reduce((sum, c) => sum + (c.rating || 0), 0) / allCompetitors.length).toFixed(1) : 0;

    // SEO / Rankings
    console.log('[DASHBOARD] loading keywords');
    let keywordsCount = 0;
    let top3Count = 0;
    try {
      const keywordsCountRes = await db.select({ count: count() }).from(seoKeywords).where(eq(seoKeywords.locationId, loc.id));
      keywordsCount = keywordsCountRes[0]?.count ? Number(keywordsCountRes[0].count) : 0;
      const top3CountRes = await db.select({ count: count() }).from(seoKeywords).where(and(eq(seoKeywords.locationId, loc.id), lte(seoKeywords.currentRank, 3)));
      top3Count = top3CountRes[0]?.count ? Number(top3CountRes[0].count) : 0;
      console.log('[DASHBOARD] keywords loaded:', keywordsCount);
    } catch (kwErr: any) {
      console.error('[DASHBOARD] failed loading keywords:', kwErr instanceof Error ? kwErr.message : kwErr);
    }

    // Profile Audit Score calculation
    let score = 0;
    if (loc.businessName) score += 5;
    if (loc.category) score += 10;
    if (loc.address) score += 5;
    if (loc.phone) score += 5;
    if (loc.websiteUri) score += 5;
    if (loc.businessHours) score += 10;
    if (loc.description) score += 10;
    if (total > 0) score += 5;
    const replyRate = total > 0 ? (total - unanswered) / total : 0;
    if (replyRate > 0.8) score += 5;

    let auditStatus = "Critical";
    if (score >= 90) auditStatus = "Excellent";
    else if (score >= 75) auditStatus = "Good";
    else if (score >= 50) auditStatus = "Needs Attention";

    // Performance
    console.log('[DASHBOARD] loading performance metrics');
    let latestPerf: any = { profileViews: 0, websiteClicks: 0, callClicks: 0 };
    try {
      const perfData = await db.select().from(metricLogs).where(eq(metricLogs.locationId, loc.id)).orderBy(desc(metricLogs.recordedDate)).limit(1);
      if (perfData[0]) latestPerf = perfData[0];
      console.log('[DASHBOARD] performance loaded');
    } catch (perfErr: any) {
      console.error('[DASHBOARD] failed loading performance:', perfErr instanceof Error ? perfErr.message : perfErr);
    }

    // Recent Posts
    console.log('[DASHBOARD] loading posts');
    let recentPostsList: any[] = [];
    try {
      recentPostsList = await db.select().from(scheduledPosts).where(eq(scheduledPosts.locationId, loc.id)).orderBy(desc(scheduledPosts.createdAt)).limit(5);
      console.log('[DASHBOARD] posts loaded:', recentPostsList.length);
    } catch (postErr: any) {
      console.error('[DASHBOARD] failed loading posts:', postErr instanceof Error ? postErr.message : postErr);
    }

    // Optimization Tasks
    const tasks = [];
    if (unanswered > 0) tasks.push({ priority: 'HIGH', title: `Reply to ${unanswered} unanswered reviews`, type: 'REVIEWS' });
    if (!loc.description) tasks.push({ priority: 'HIGH', title: 'Add business description', type: 'PROFILE' });
    if (!loc.businessHours) tasks.push({ priority: 'MEDIUM', title: 'Set business hours', type: 'PROFILE' });
    if (recentPostsList.length === 0) tasks.push({ priority: 'MEDIUM', title: 'Publish your first Google post', type: 'POSTS' });

    console.log('[DASHBOARD] summary query completed successfully');
    res.json({
      success: true,
      google: {
        oauthConnected: hasOAuthToken,
        connected: hasOAuthToken,
        status: googleStatusState,
        apiAccess: googleApiAccess,
        lastSyncedAt: user?.googleLastSyncedAt || loc.createdAt,
        accounts: 1,
        locations: locations.length,
        quotaNotGranted: cooldown.quotaNotGranted,
        rateLimited: cooldown.inCooldown
      },
      user: {
        email: req.user?.email || req.dbUser.email,
        emailVerified: !!(req.user?.email_verified),
        name: req.dbUser.name || ''
      },
      reviews: {
        total,
        averageRating: parseFloat(avgRating as string),
        unanswered,
        positive,
        neutral,
        negative
      },
      competitors: {
        tracked: allCompetitors.length,
        totalReviews: compTotalReviews,
        averageRating: parseFloat(compAvgRating as string),
        photos: null
      },
      profileAudit: {
        score,
        status: auditStatus
      },
      ai: {
        creditsRemaining: creditAccount.creditsRemaining ?? 10
      },
      performance: {
        profileViews: latestPerf.profileViews || 0,
        searches: 0,
        websiteClicks: latestPerf.websiteClicks || 0,
        calls: latestPerf.callClicks || 0,
        directions: 0
      },
      rankings: {
        tracked: keywordsCount,
        top3: top3Count,
        top10: 0,
        improved: 0,
        declined: 0
      },
      recentReviews: allReviews.slice(0, 5),
      recentPosts: recentPostsList,
      optimizationTasks: tasks
    });
  } catch (error: any) {
    console.error('[DASHBOARD FETCH ERROR]', {
      message: error instanceof Error ? error.message : error,
      cause: error instanceof Error ? (error as any).cause : undefined
    });
    res.status(500).json({
      success: false,
      code: 'DASHBOARD_FETCH_FAILED',
      message: 'Failed to fetch dashboard'
    });
  }
});

app.get('/api/analytics', requireAuth, async (req: AuthRequest, res) => {
  try {
    const locationsList = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id));
    const locationIds = locationsList.map(l => l.id);

    if (locationIds.length === 0) {
      return res.json({ performance: [] });
    }

    const performance = await db.select()
      .from(metricLogs)
      .where(inArray(metricLogs.locationId, locationIds))
      .orderBy(asc(metricLogs.recordedDate))
      .limit(30);

    // Format for charts
    const chartData = performance.map(p => ({
      date: p.recordedDate ? new Date(p.recordedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?',
      views: p.profileViews || 0,
      searches: (p.searchViews || 0) + (p.searchesMaps || 0),
      interactions: (p.websiteClicks || 0) + (p.callClicks || 0)
    }));

    res.json({ performance: chartData });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Missing Endpoints added for generated pages
app.get('/api/seo/audit', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await db.select().from(seoAudits).innerJoin(businessLocations, eq(seoAudits.locationId, businessLocations.id)).where(eq(businessLocations.userId, req.dbUser.id));
    res.json(data.map(d => d.seo_audits));
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load' });
  }
});

app.get('/api/settings/review-automation', requireAuth, async (req: AuthRequest, res) => {
  res.json([]);
});

app.get('/api/settings/templates', requireAuth, async (req: AuthRequest, res) => {
  res.json([]);
});

app.get('/api/ai/studio', requireAuth, async (req: AuthRequest, res) => {
  res.json([]);
});

app.get('/api/ai/images', requireAuth, async (req: AuthRequest, res) => {
  res.json([]);
});

const DEFAULT_WHATSAPP_ACCOUNTS = [
  {
    id: 'wa_1',
    name: 'Main Business Line',
    phoneNumber: '+1 (555) 019-2834',
    status: 'Connected',
    autoReply: true,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'wa_2',
    name: 'Customer Support Desk',
    phoneNumber: '+1 (555) 438-9210',
    status: 'Connected',
    autoReply: false,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

app.get('/api/settings/whatsapp', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const record = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'whatsapp_accounts'))
    );

    if (record.length > 0 && Array.isArray(record[0].value) && record[0].value.length > 0) {
      return res.json(record[0].value);
    }

    // Persist default accounts in database if first time
    if (record.length === 0) {
      await db.insert(appSettings).values({
        userId,
        key: 'whatsapp_accounts',
        value: DEFAULT_WHATSAPP_ACCOUNTS,
        updatedAt: new Date()
      });
    } else {
      await db.update(appSettings).set({
        value: DEFAULT_WHATSAPP_ACCOUNTS,
        updatedAt: new Date()
      }).where(eq(appSettings.id, record[0].id));
    }

    res.json(DEFAULT_WHATSAPP_ACCOUNTS);
  } catch (err) {
    console.error('Error fetching WhatsApp accounts from database:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch WhatsApp accounts' });
  }
});

app.patch(['/api/settings/whatsapp/:id/auto-reply', '/api/settings/whatsapp/:id'], requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const accountId = req.params.id;
    const { autoReply, autoReplyStatus, status } = req.body;

    const record = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'whatsapp_accounts'))
    );

    let accounts: any[] = record.length > 0 && Array.isArray(record[0].value) 
      ? [...record[0].value] 
      : [...DEFAULT_WHATSAPP_ACCOUNTS];

    const targetIdx = accounts.findIndex((a: any) => String(a.id) === String(accountId));
    if (targetIdx === -1) {
      return res.status(404).json({ success: false, message: 'WhatsApp account number not found' });
    }

    const newAutoReply = typeof autoReply === 'boolean' 
      ? autoReply 
      : (typeof autoReplyStatus === 'boolean' ? autoReplyStatus : !accounts[targetIdx].autoReply);

    accounts[targetIdx] = {
      ...accounts[targetIdx],
      autoReply: newAutoReply,
      status: status || accounts[targetIdx].status || 'Connected',
      updatedAt: new Date().toISOString()
    };

    if (record.length === 0) {
      await db.insert(appSettings).values({
        userId,
        key: 'whatsapp_accounts',
        value: accounts,
        updatedAt: new Date()
      });
    } else {
      await db.update(appSettings).set({
        value: accounts,
        updatedAt: new Date()
      }).where(eq(appSettings.id, record[0].id));
    }

    console.log(`[WHATSAPP DB] Updated auto-reply for account ${accountId} (User ${userId}): autoReply = ${newAutoReply}`);

    res.json({
      success: true,
      message: `Auto-reply status updated to ${newAutoReply ? 'enabled' : 'disabled'}`,
      account: accounts[targetIdx],
      autoReply: newAutoReply,
      accounts
    });
  } catch (err: any) {
    console.error('Error updating WhatsApp auto-reply status in database:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to update auto-reply status' });
  }
});

app.post('/api/settings/whatsapp', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const { name, phoneNumber, autoReply } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const record = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'whatsapp_accounts'))
    );

    let accounts: any[] = record.length > 0 && Array.isArray(record[0].value) 
      ? [...record[0].value] 
      : [...DEFAULT_WHATSAPP_ACCOUNTS];

    const newAccount = {
      id: `wa_${Date.now()}`,
      name: name || 'Business Line',
      phoneNumber,
      status: 'Connected',
      autoReply: typeof autoReply === 'boolean' ? autoReply : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    accounts = [newAccount, ...accounts];

    if (record.length === 0) {
      await db.insert(appSettings).values({
        userId,
        key: 'whatsapp_accounts',
        value: accounts,
        updatedAt: new Date()
      });
    } else {
      await db.update(appSettings).set({
        value: accounts,
        updatedAt: new Date()
      }).where(eq(appSettings.id, record[0].id));
    }

    res.json({ success: true, account: newAccount, accounts });
  } catch (err: any) {
    console.error('Error connecting WhatsApp number:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to connect WhatsApp number' });
  }
});

app.delete('/api/settings/whatsapp/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const accountId = req.params.id;

    const record = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'whatsapp_accounts'))
    );

    if (record.length > 0 && Array.isArray(record[0].value)) {
      const filtered = record[0].value.filter((a: any) => String(a.id) !== String(accountId));
      await db.update(appSettings).set({
        value: filtered,
        updatedAt: new Date()
      }).where(eq(appSettings.id, record[0].id));
    }

    res.json({ success: true, message: 'WhatsApp account removed' });
  } catch (err: any) {
    console.error('Error removing WhatsApp number:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to remove WhatsApp number' });
  }
});

app.post('/api/settings/whatsapp/bulk', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const { action, ids, autoReply } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array is required for bulk actions' });
    }

    const idSet = new Set(ids.map((id: any) => String(id)));

    const record = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'whatsapp_accounts'))
    );

    let accounts: any[] = record.length > 0 && Array.isArray(record[0].value)
      ? [...record[0].value]
      : [...DEFAULT_WHATSAPP_ACCOUNTS];

    let affectedCount = 0;

    if (action === 'enable_auto_reply' || action === 'disable_auto_reply' || typeof autoReply === 'boolean') {
      const targetAutoReply = typeof autoReply === 'boolean' 
        ? autoReply 
        : (action === 'enable_auto_reply');

      accounts = accounts.map((acc: any) => {
        if (idSet.has(String(acc.id))) {
          affectedCount++;
          return {
            ...acc,
            autoReply: targetAutoReply,
            updatedAt: new Date().toISOString()
          };
        }
        return acc;
      });
    } else if (action === 'delete' || action === 'remove') {
      const initialLen = accounts.length;
      accounts = accounts.filter((acc: any) => !idSet.has(String(acc.id)));
      affectedCount = initialLen - accounts.length;
    } else {
      return res.status(400).json({ success: false, message: `Unknown bulk action: ${action}` });
    }

    if (record.length === 0) {
      await db.insert(appSettings).values({
        userId,
        key: 'whatsapp_accounts',
        value: accounts,
        updatedAt: new Date()
      });
    } else {
      await db.update(appSettings).set({
        value: accounts,
        updatedAt: new Date()
      }).where(eq(appSettings.id, record[0].id));
    }

    console.log(`[WHATSAPP DB] Bulk action "${action}" completed for user ${userId} on ${affectedCount} accounts`);

    res.json({
      success: true,
      message: `Successfully processed ${affectedCount} account(s)`,
      affectedCount,
      accounts
    });
  } catch (err: any) {
    console.error('Error in WhatsApp bulk action:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to process bulk action' });
  }
});

const DEFAULT_WHATSAPP_TEMPLATES = [
  {
    id: 'tpl_1',
    name: 'Standard Review Request',
    category: 'Review Request',
    language: 'English (US)',
    isDefault: true,
    content: 'Hi {customer_name}! Thank you for visiting {business_name}. We hope you had a great experience! Could you please take 30 seconds to leave us a review here? {review_link} Your feedback helps us grow!',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tpl_2',
    name: 'Friendly Service Follow-Up',
    category: 'Follow-up',
    language: 'English (US)',
    isDefault: false,
    content: 'Hello {customer_name}, just checking in from {business_name}! How was your recent service with us? If you enjoyed your experience, we would appreciate a quick rating here: {review_link}. Have a fantastic day!',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tpl_3',
    name: 'Review Incentive Offer',
    category: 'Incentive',
    language: 'English (US)',
    isDefault: false,
    content: 'Hi {customer_name}! Share your thoughts about {business_name} at {review_link} and get 10% off your next visit as a thank you! Show this message at checkout.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tpl_4',
    name: 'VIP Client Review Request',
    category: 'VIP Request',
    language: 'English (US)',
    isDefault: false,
    content: 'Dear {customer_name}, as one of our valued clients at {business_name}, your opinion means the world to us. Please share your feedback on Google here: {review_link}. Best regards, the team at {business_name}.',
    createdAt: new Date().toISOString()
  }
];

app.get('/api/whatsapp/templates', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const record = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'whatsapp_templates'))
    );
    if (record.length > 0 && Array.isArray(record[0].value) && record[0].value.length > 0) {
      return res.json(record[0].value);
    }
    res.json(DEFAULT_WHATSAPP_TEMPLATES);
  } catch (err) {
    console.error('Error fetching WhatsApp templates:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch WhatsApp templates' });
  }
});

app.post('/api/whatsapp/templates', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser.id;
    const { templates } = req.body;
    if (!Array.isArray(templates)) {
      return res.status(400).json({ success: false, message: 'Templates array required' });
    }

    const existing = await db.select().from(appSettings).where(
      and(eq(appSettings.userId, userId), eq(appSettings.key, 'whatsapp_templates'))
    );

    if (existing.length === 0) {
      await db.insert(appSettings).values({
        userId,
        key: 'whatsapp_templates',
        value: templates,
        updatedAt: new Date()
      });
    } else {
      await db.update(appSettings).set({
        value: templates,
        updatedAt: new Date()
      }).where(eq(appSettings.id, existing[0].id));
    }

    res.json({ success: true, templates });
  } catch (err) {
    console.error('Error saving WhatsApp templates:', err);
    res.status(500).json({ success: false, message: 'Failed to save WhatsApp templates' });
  }
});

app.get('/api/billing/subscription', requireAuth, async (req: AuthRequest, res) => {
  res.json({
    plan: 'Professional Plan',
    renewalDate: 'Sep 24, 2026',
    price: 49,
    status: 'ACTIVE'
  });
});

app.get('/api/settings/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await db.select().from(users).where(eq(users.id, req.dbUser.id));
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load' });
  }
});


// CRON JOB: Every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running background job to publish posts...');
  try {
    const now = new Date();
    const pendingPosts = await db.select({
      id: scheduledPosts.id,
      content: scheduledPosts.content,
      imageUrl: scheduledPosts.imageUrl,
      googleLocationId: businessLocations.googleLocationId,
      userId: businessLocations.userId
    }).from(scheduledPosts)
      .innerJoin(businessLocations, eq(scheduledPosts.locationId, businessLocations.id))
      .where(
        and(
          eq(scheduledPosts.status, 'PENDING'),
          lte(scheduledPosts.scheduledFor, now)
        )
      );
    
    for (const post of pendingPosts) {
      console.log(`Publishing post ${post.id}`);
      try {
        const token = await getValidGoogleAccessToken(post.userId);
        if (!token) throw new Error('No Google token for user');

        const result = await createGooglePost(token, post.googleLocationId, post.content, post.imageUrl || undefined);

        await db.update(scheduledPosts).set({ 
          status: 'PUBLISHED',
          googlePostId: result.name || 'unknown',
          publishedAt: new Date()
        }).where(eq(scheduledPosts.id, post.id));
      } catch (err: any) {
        console.error(`Failed to publish post ${post.id}:`, err);
        await db.update(scheduledPosts).set({ 
          status: 'FAILED', 
          errorMessage: err.message || String(err),
          lastAttemptAt: new Date()
        }).where(eq(scheduledPosts.id, post.id));
      }
    }
  } catch (error) {
    console.error('Error running cron job:', error);
  }
});

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
  });
}

startServer();

