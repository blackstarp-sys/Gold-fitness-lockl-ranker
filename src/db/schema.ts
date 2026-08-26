import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, doublePrecision, jsonb, boolean, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  googleAccessToken: text('google_access_token'),
  googleRefreshToken: text('google_refresh_token'),
  googleTokenExpiresAt: timestamp('google_token_expires_at', { withTimezone: true }),
  googleScopes: text('google_scopes'),
  googleConnectedAt: timestamp('google_connected_at', { withTimezone: true }),
  googleLastSyncedAt: timestamp('google_last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const googleBusinessAccounts = pgTable('google_business_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  googleAccountId: text('google_account_id').notNull(),
  accountName: text('account_name'),
  accountType: text('account_type'),
  role: text('role'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const socialAccounts = pgTable('social_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  platformName: text('platform_name').notNull(), // facebook, instagram, linkedin, x
  accessToken: text('access_token').notNull(),
  profileId: text('profile_id').notNull(),
  profileName: text('profile_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const businessLocations = pgTable('business_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  googleLocationId: text('google_location_id').notNull().unique(),
  googleAccountId: text('google_account_id'),
  businessName: text('business_name').notNull(),
  address: text('address'),
  category: text('category'),
  phone: text('phone'),
  websiteUri: text('website_uri'),
  businessHours: jsonb('business_hours'),
  description: text('description'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  googleReviewId: text('google_review_id').unique(),
  reviewerName: text('reviewer_name'),
  reviewerPhoto: text('reviewer_photo'),
  starRating: integer('star_rating'),
  comment: text('comment'),
  aiDraftReply: text('ai_draft_reply'),
  publishedReply: text('published_reply'),
  isReplied: boolean('is_replied').default(false),
  reviewDate: timestamp('review_date', { withTimezone: true }),
  replyStatus: text('reply_status').default('PENDING'), // PENDING, REPLIED
  reviewTimestamp: timestamp('review_timestamp', { withTimezone: true }),
  sentiment: text('sentiment'),
  sentimentScore: doublePrecision('sentiment_score'),
  needsAttention: boolean('needs_attention').default(false),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scheduledPosts = pgTable('scheduled_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  callToAction: text('call_to_action'),
  actionUrl: text('action_url'),
  platforms: jsonb('platforms'), // Array of platforms
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('PENDING'), // PENDING, PUBLISHED, FAILED
  errorMessage: text('error_message'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  googlePostId: text('google_post_id'),
  retryCount: integer('retry_count').default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const metricLogs = pgTable('metric_logs', {
  id: serial('id').primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  profileViews: integer('profile_views').notNull().default(0),
  searchViews: integer('search_views').notNull().default(0),
  searchesMaps: integer('searches_maps').notNull().default(0),
  websiteClicks: integer('website_clicks').notNull().default(0),
  callClicks: integer('call_clicks').notNull().default(0),
  recordedDate: timestamp('recorded_date', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiCreditAccounts = pgTable('ai_credit_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  planId: text('plan_id').notNull().default('FREE'),
  monthlyAllowance: integer('monthly_allowance').notNull().default(10),
  creditsRemaining: integer('credits_remaining').notNull().default(10),
  resetAt: timestamp('reset_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiCreditTransactions = pgTable('ai_credit_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // CREDIT, DEBIT, RESET, PURCHASE
  credits: integer('credits').notNull(),
  feature: text('feature'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  businessLocations: many(businessLocations),
  socialAccounts: many(socialAccounts),
  aiCreditAccount: one(aiCreditAccounts, { fields: [users.id], references: [aiCreditAccounts.userId] }),
}));

export const socialAccountsRelations = relations(socialAccounts, ({ one }) => ({
  user: one(users, { fields: [socialAccounts.userId], references: [users.id] }),
}));

export const seoKeywords = pgTable('seo_keywords', {
  id: serial('id').primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  keyword: text('keyword').notNull(),
  currentRank: integer('current_rank'),
  searchVolume: integer('search_volume'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const keywordRankHistory = pgTable('keyword_rank_history', {
  id: serial('id').primaryKey(),
  keywordId: integer('keyword_id').references(() => seoKeywords.id).notNull(),
  rank: integer('rank').notNull(),
  recordedDate: timestamp('recorded_date', { withTimezone: true }).defaultNow(),
});

export const competitors = pgTable('competitors', {
  id: serial('id').primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  businessName: text('business_name').notNull(),
  googleMapsUrl: text('google_maps_url'),
  currentRank: integer('current_rank'),
  rating: doublePrecision('rating'),
  reviewCount: integer('review_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const citationSources = pgTable('citation_sources', {
  id: serial('id').primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  platform: text('platform').notNull(), // google, facebook, justdial, etc.
  listingUrl: text('listing_url'),
  syncStatus: text('sync_status').notNull().default('PENDING'), // PENDING, SYNCED, ERROR
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // WHATSAPP, EMAIL
  status: text('status').notNull().default('DRAFT'), // DRAFT, ACTIVE, PAUSED
  messageTemplate: text('message_template'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaignLogs = pgTable('campaign_logs', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id').references(() => campaigns.id).notNull(),
  recipient: text('recipient').notNull(),
  status: text('status').notNull(), // SENT, FAILED, READ
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
});

export const businessLocationsRelations = relations(businessLocations, ({ one, many }) => ({
  user: one(users, { fields: [businessLocations.userId], references: [users.id] }),
  reviews: many(reviews),
  scheduledPosts: many(scheduledPosts),
  metricLogs: many(metricLogs),
  seoKeywords: many(seoKeywords),
  competitors: many(competitors),
  citationSources: many(citationSources),
  campaigns: many(campaigns),
}));

export const seoKeywordsRelations = relations(seoKeywords, ({ many }) => ({
  history: many(keywordRankHistory),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  logs: many(campaignLogs),
}));

export const competitorRankHistory = pgTable('competitor_rank_history', {
  id: serial('id').primaryKey(),
  competitorId: integer('competitor_id').references(() => competitors.id).notNull(),
  rank: integer('rank').notNull(),
  recordedDate: timestamp('recorded_date', { withTimezone: true }).defaultNow(),
});

export const seoAudits = pgTable('seo_audits', {
  id: serial('id').primaryKey(),
  locationId: uuid('location_id').references(() => businessLocations.id).notNull(),
  url: text('url').notNull(),
  score: integer('score'),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow(),
});

export const seoAuditItems = pgTable('seo_audit_items', {
  id: serial('id').primaryKey(),
  auditId: integer('audit_id').references(() => seoAudits.id).notNull(),
  checkKey: text('check_key').notNull(),
  status: text('status').notNull(), // PASS, FAIL, WARNING
  message: text('message'),
  details: jsonb('details'),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  message: text('message'),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  key: text('key').notNull(),
  value: jsonb('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

