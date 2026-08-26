export interface UserTokens {
  google_access_token?: string;
}

export interface SocialAccount {
  id: number;
  platformName: string;
  profileId: string;
  profileName: string | null;
}

export interface Review {
  id: string;
  reviewerName: string;
  starRating: number;
  comment: string;
  replyStatus: 'PENDING' | 'REPLIED';
  publishedReply: string | null;
  reviewTimestamp: string;
  googleReviewId: string;
  locationId: string;
  businessName: string;
  googleAccountId: string;
  googleLocationId: string;
}

export interface ScheduledPost {
  id: number;
  content: string;
  imageUrl: string | null;
  platforms?: string[];
  scheduledFor: string;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  errorMessage: string | null;
  locationId: string;
  businessName: string;
}

export interface BusinessLocation {
  id: string;
  userId: number;
  businessName: string;
  googleAccountId: string;
  googleLocationId: string;
  description?: string;
  phone?: string;
  websiteUri?: string;
  category?: string;
  businessHours?: any;
  createdAt: string;
}
