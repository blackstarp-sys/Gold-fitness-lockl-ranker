export type IntegrationErrorCode =
  | 'GOOGLE_API_QUOTA_PENDING'
  | 'GOOGLE_API_QUOTA_NOT_GRANTED'
  | 'RANK_PROVIDER_REQUIRED'
  | 'GEMINI_CONFIGURATION_REQUIRED'
  | 'WHATSAPP_CONFIGURATION_REQUIRED'
  | 'GOOGLE_NOT_CONNECTED'
  | 'GOOGLE_REAUTH_REQUIRED'
  | 'CONFIGURATION_REQUIRED'
  | string;

export interface IntegrationErrorDetails {
  title: string;
  subtitle?: string;
  message: string;
  buttonText: string;
  targetUrl: string;
  iconType: 'google' | 'rank' | 'gemini' | 'whatsapp' | 'generic' | 'warning';
}

/**
 * Maps integration error codes to specific, actionable error messages and Settings navigation destinations.
 * Generic fallback message is used ONLY when the exact integration source is unknown.
 */
export function getIntegrationErrorDetails(
  code?: string,
  fallbackTitle?: string,
  fallbackMessage?: string
): IntegrationErrorDetails {
  const normalized = (code || '').toUpperCase().trim();

  if (
    normalized === 'GOOGLE_API_QUOTA_PENDING' ||
    normalized === 'GOOGLE_API_QUOTA_NOT_GRANTED' ||
    normalized === 'QUOTA_TEMPORARILY_EXCEEDED' ||
    normalized === 'GOOGLE_RATE_LIMITED'
  ) {
    return {
      title: 'Google Business Profile Connected',
      subtitle: 'API Access Pending',
      message: 'Your Google Business Profile is connected, but Google API access/quota is still pending approval.',
      buttonText: 'Open Google Settings',
      targetUrl: '/settings?tab=integrations#google',
      iconType: 'google',
    };
  }

  if (normalized === 'RANK_PROVIDER_REQUIRED') {
    return {
      title: 'Rank Provider Required',
      message: 'Configure a rank tracking provider to enable Google Maps rank tracking.',
      buttonText: 'Configure Rank Provider',
      targetUrl: '/settings?tab=integrations#ranking',
      iconType: 'rank',
    };
  }

  if (
    normalized === 'GEMINI_CONFIGURATION_REQUIRED' ||
    normalized === 'AI_CONFIGURATION_REQUIRED'
  ) {
    return {
      title: 'AI Configuration Required',
      message: 'Configure Gemini API access to use AI generation features.',
      buttonText: 'Configure Gemini AI',
      targetUrl: '/settings?tab=integrations#gemini',
      iconType: 'gemini',
    };
  }

  if (normalized === 'WHATSAPP_CONFIGURATION_REQUIRED') {
    return {
      title: 'WhatsApp Configuration Required',
      message: 'Configure WhatsApp Business API credentials in Settings to enable WhatsApp messaging.',
      buttonText: 'Configure WhatsApp',
      targetUrl: '/settings?tab=integrations#whatsapp',
      iconType: 'whatsapp',
    };
  }

  if (normalized === 'GOOGLE_NOT_CONNECTED') {
    return {
      title: 'Google Business Profile Not Connected',
      message: 'Connect your Google Business Profile to sync locations, reviews, and search insights.',
      buttonText: 'Connect Google Profile',
      targetUrl: '/google-business',
      iconType: 'google',
    };
  }

  if (normalized === 'GOOGLE_REAUTH_REQUIRED') {
    return {
      title: 'Google Authorization Expired',
      message: 'Your Google authorization has expired. Please reconnect your Google account.',
      buttonText: 'Reconnect Google',
      targetUrl: '/google-business',
      iconType: 'google',
    };
  }

  // Generic fallback used ONLY when source is truly unknown
  return {
    title: fallbackTitle || 'Configuration Required',
    message: fallbackMessage || 'Action requires additional configuration in Settings.',
    buttonText: 'Open Settings',
    targetUrl: '/settings',
    iconType: 'generic',
  };
}
