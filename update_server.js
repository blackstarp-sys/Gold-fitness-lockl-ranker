import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// Update imports
content = content.replace(
  /import \{ getValidGoogleAccessToken \} from '\.\/src\/server\/googleAuth\.ts';/g,
  "import { getValidGoogleAccessToken, GoogleNotConnectedError } from './src/server/googleTokens.ts';\nimport { getGoogleAuthorizationUrl, createGoogleOAuthClient } from './src/server/googleOAuth.ts';\nimport { sql } from 'drizzle-orm';"
);

// Health check
content = content.replace(
  /app\.get\('\/api\/health', \(_req, res\) => \{\n\s*res\.json\(\{ status: 'ok' \}\);\n\}\);/,
  `app.get('/api/health', async (_req, res) => {
  try {
    await db.execute(sql\`select 1\`);
    res.json({ success: true, server: 'ok', database: 'connected' });
  } catch (error) {
    console.error('[HEALTH DATABASE]', error);
    res.status(503).json({ success: false, server: 'ok', database: 'disconnected' });
  }
});`
);

// Google connect and callback
const googleEndpoints = `
app.get('/api/google/connect', requireAuth, async (req, res) => {
  try {
    // Basic state with user id
    const state = Buffer.from(JSON.stringify({ userId: req.dbUser.id, nonce: Math.random() })).toString('base64');
    const authorizationUrl = getGoogleAuthorizationUrl(state);
    res.json({ success: true, authorizationUrl });
  } catch (error) {
    console.error('[Google Connect]', error);
    res.status(500).json({ success: false, message: 'Failed to start Google connection' });
  }
});

app.get('/api/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code or state');
    
    const stateObj = JSON.parse(Buffer.from(state as string, 'base64').toString('utf8'));
    if (!stateObj.userId) return res.status(400).send('Invalid state');
    
    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);
    
    const userList = await db.select().from(users).where(eq(users.id, stateObj.userId)).limit(1);
    const user = userList[0];
    
    await db.update(users).set({
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token || user.googleRefreshToken, // preserve if missing
      googleTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleConnectedAt: new Date(),
      googleScopes: tokens.scope || null
    }).where(eq(users.id, stateObj.userId));
    
    res.redirect('/business-profile?connected=1');
  } catch (error) {
    console.error('[Google Callback]', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/google/status', requireAuth, async (req, res) => {
  try {
    const userList = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    const user = userList[0];
    const locs = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id));
    
    res.json({
      configured: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      connected: !!user.googleAccessToken,
      connectedAt: user.googleConnectedAt,
      locations: locs.length
    });
  } catch (error) {
    console.error('[Google Status]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch status' });
  }
});

function googleRatingToNumber(rating: string): number {
  switch (rating) {
    case 'ONE': return 1;
    case 'TWO': return 2;
    case 'THREE': return 3;
    case 'FOUR': return 4;
    case 'FIVE': return 5;
    default: return 0;
  }
}
`;

content = content.replace(/app\.post\('\/api\/auth\/google-tokens', requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?\}\);/, googleEndpoints);


// Sync endpoint
content = content.replace(
  /app\.post\('\/api\/sync', requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?\}\);/,
  `app.post('/api/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const token = await getValidGoogleAccessToken(req.dbUser.id);
    
    const accounts = await getBusinessAccounts(token);
    if (!accounts || accounts.length === 0) {
      return res.json({ success: true, message: 'No accounts found' });
    }
    const accountName = accounts[0].name;
    const accountId = accountName.split('/')[1];
    
    const locations = await getLocations(token, accountName);
    
    for (const loc of locations) {
      const locId = loc.name.split('/')[1];
      await db.insert(businessLocations).values({
        userId: req.dbUser.id,
        googleAccountId: accountId,
        googleLocationId: locId,
        businessName: loc.title,
        phone: loc.primaryPhone,
        websiteUri: loc.websiteUri,
        category: loc.primaryCategory?.displayName
      }).onConflictDoUpdate({
        target: businessLocations.googleLocationId,
        set: {
          businessName: loc.title,
          phone: loc.primaryPhone,
          websiteUri: loc.websiteUri,
          category: loc.primaryCategory?.displayName
        }
      });
      
      const dbLocRes = await db.select().from(businessLocations).where(eq(businessLocations.googleLocationId, locId)).limit(1);
      const dbLoc = dbLocRes[0];
      
      const googleReviews = await fetchGoogleReviews(token, accountId, locId);
      for (const gr of googleReviews) {
        const reviewId = gr.reviewId;
        const isReplied = !!gr.reviewReply;
        
        await db.insert(reviews).values({
          locationId: dbLoc.id,
          googleReviewId: reviewId,
          reviewerName: gr.reviewer?.displayName || 'Unknown',
          reviewerPhoto: gr.reviewer?.profilePhotoUrl,
          starRating: googleRatingToNumber(gr.starRating),
          comment: gr.comment,
          reviewTimestamp: gr.createTime ? new Date(gr.createTime) : new Date(),
          replyStatus: isReplied ? 'REPLIED' : 'PENDING',
          publishedReply: isReplied ? gr.reviewReply.comment : null,
          lastSyncedAt: new Date()
        }).onConflictDoUpdate({
          target: reviews.googleReviewId,
          set: {
            reviewerName: gr.reviewer?.displayName || 'Unknown',
            reviewerPhoto: gr.reviewer?.profilePhotoUrl,
            starRating: googleRatingToNumber(gr.starRating),
            comment: gr.comment,
            replyStatus: isReplied ? 'REPLIED' : 'PENDING',
            publishedReply: isReplied ? gr.reviewReply.comment : null,
            lastSyncedAt: new Date()
          }
        });
      }
    }
    
    res.json({ success: true, message: 'Sync complete' });
  } catch (error: any) {
    console.error('[Sync]', error);
    if (error instanceof GoogleNotConnectedError) {
      return res.status(409).json({ success: false, code: 'GOOGLE_NOT_CONNECTED', message: error.message });
    }
    if (error.response?.status === 401) {
      return res.status(401).json({ success: false, code: 'GOOGLE_REAUTH_REQUIRED', message: 'Reconnect Google Business Profile.' });
    }
    res.status(500).json({ success: false, code: 'GOOGLE_API_ERROR', message: 'Google Business Profile request failed.' });
  }
});`
);

// Reviews fetch endpoint
content = content.replace(
  /app\.get\('\/api\/reviews', requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?\}\);/,
  `app.get('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const allReviews = await db.select({
      id: reviews.id,
      reviewerName: reviews.reviewerName,
      reviewerPhoto: reviews.reviewerPhoto,
      starRating: reviews.starRating,
      comment: reviews.comment,
      replyStatus: reviews.replyStatus,
      publishedReply: reviews.publishedReply,
      reviewTimestamp: reviews.reviewTimestamp,
      needsAttention: reviews.needsAttention,
      aiDraftReply: reviews.aiDraftReply,
      googleReviewId: reviews.googleReviewId,
      locationId: reviews.locationId,
      businessName: businessLocations.businessName
    })
    .from(reviews)
    .innerJoin(businessLocations, eq(reviews.locationId, businessLocations.id))
    .where(eq(businessLocations.userId, req.dbUser.id))
    .orderBy(desc(reviews.reviewTimestamp));
    
    res.json(allReviews);
  } catch (error) {
    console.error('[GET /api/reviews]', error);
    res.status(500).json({ success: false, code: 'REVIEWS_FETCH_FAILED', message: 'Failed to fetch reviews' });
  }
});`
);

// Reviews publish endpoint
content = content.replace(
  /app\.post\('\/api\/reviews\/:id\/publish', requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?\}\);/,
  `app.post('/api/reviews/:id/publish', requireAuth, async (req: AuthRequest, res) => {
  try {
    const reviewId = parseInt(req.params.id as string);
    const { replyText } = req.body;
    
    const reviewRes = await db.select({
      review: reviews,
      location: businessLocations
    }).from(reviews)
      .innerJoin(businessLocations, eq(reviews.locationId, businessLocations.id))
      .where(and(eq(reviews.id, reviewId), eq(businessLocations.userId, req.dbUser.id)))
      .limit(1);
      
    if (reviewRes.length === 0) return res.status(403).json({ success: false, message: 'Unauthorized or review not found' });
    
    const { review, location } = reviewRes[0];
    
    const token = await getValidGoogleAccessToken(req.dbUser.id);
    
    await replyToGoogleReview(token, location.googleAccountId!, location.googleLocationId, review.googleReviewId, replyText);
    
    await db.update(reviews)
      .set({
        replyStatus: 'REPLIED',
        publishedReply: replyText,
        aiDraftReply: null
      })
      .where(eq(reviews.id, review.id));
      
    res.json({ success: true });
  } catch (error: any) {
    console.error('Publish Error:', error);
    res.status(500).json({ success: false, code: 'PUBLISH_FAILED', message: error.message || 'Failed to publish to Google' });
  }
});`
);

// Dashboard summary endpoint
content = content.replace(
  /app\.get\('\/api\/dashboard\/summary', requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?\}\);/,
  `app.get('/api/dashboard/summary', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userRes = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    const googleConnected = !!userRes[0]?.googleAccessToken;
    
    const locations = await db.select().from(businessLocations).where(eq(businessLocations.userId, req.dbUser.id));
    
    if (locations.length === 0 || !googleConnected) {
      return res.json({
        googleConnected,
        business: { name: 'No Business Connected', rating: 0, reviewCount: 0 },
        reviews: { total: 0, unanswered: 0, negative: 0, positive: 0 },
        seo: { localScore: 0, trackedKeywords: 0, top3Keywords: 0 },
        performance: { profileViews: 0, websiteClicks: 0, calls: 0, directions: 0 }
      });
    }
    
    const loc = locations[0];
    const allReviews = await db.select().from(reviews).where(eq(reviews.locationId, loc.id));
    const total = allReviews.length;
    const unanswered = allReviews.filter(r => r.replyStatus === 'PENDING').length;
    const negative = allReviews.filter(r => r.starRating <= 2).length;
    const positive = allReviews.filter(r => r.starRating >= 4).length;
    const ratingSum = allReviews.reduce((sum, r) => sum + r.starRating, 0);
    const avgRating = total > 0 ? (ratingSum / total).toFixed(1) : 0;
    
    res.json({
      googleConnected: true,
      business: { name: loc.businessName, rating: avgRating, reviewCount: total },
      reviews: { total, unanswered, negative, positive },
      seo: { localScore: 91, trackedKeywords: 25, top3Keywords: 14 },
      performance: { profileViews: 0, websiteClicks: 0, calls: 0, directions: 0 }
    });
  } catch (error) {
    console.error('[Dashboard]', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});`
);

// Cron job
content = content.replace(
  /cron\.schedule\('\*\/5 \* \* \* \*', async \(\) => \{[\s\S]*?\}\);/g,
  `cron.schedule('*/5 * * * *', async () => {
  console.log('[POST CRON] Checking scheduled posts');
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
      console.log(\`Publishing post \${post.id}\`);
      try {
        const token = await getValidGoogleAccessToken(post.userId);
        if (!token) throw new GoogleNotConnectedError('No Google token for user');
        
        const result = await createGooglePost(token, post.googleLocationId, post.content, post.imageUrl || undefined);
        await db.update(scheduledPosts).set({ 
          status: 'PUBLISHED',
          googlePostId: result.name || 'unknown',
          publishedAt: new Date()
        }).where(eq(scheduledPosts.id, post.id));
      } catch (err: any) {
        console.error(\`Failed to publish post \${post.id}:\`, err);
        if (err instanceof GoogleNotConnectedError) {
           // Skip failing configuration, leave pending or fail
           await db.update(scheduledPosts).set({ 
             status: 'FAILED', 
             errorMessage: 'FAILED_CONFIGURATION',
             lastAttemptAt: new Date()
           }).where(eq(scheduledPosts.id, post.id));
        } else {
          await db.update(scheduledPosts).set({ 
            status: 'FAILED', 
            errorMessage: err.message || String(err),
            lastAttemptAt: new Date()
          }).where(eq(scheduledPosts.id, post.id));
        }
      }
    }
  } catch (error) {
    console.error('Error running cron job:', error);
  }
});`
);

fs.writeFileSync('server.ts', content);
