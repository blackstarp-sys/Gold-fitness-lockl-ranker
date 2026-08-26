import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Globe, 
  MapPin, 
  Sparkles, 
  MessageSquare, 
  AlertCircle, 
  Settings, 
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { getIntegrationErrorDetails, IntegrationErrorCode } from '../lib/integrationErrors.ts';

interface Props {
  code?: IntegrationErrorCode;
  title?: string;
  subtitle?: string;
  message?: string;
  type?: 'config' | 'quota' | 'error';
  buttonText?: string;
  targetUrl?: string;
  onRetry?: () => void;
  inline?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const IntegrationAlertBanner: React.FC<{
  code?: IntegrationErrorCode;
  title?: string;
  message?: string;
  buttonText?: string;
  targetUrl?: string;
  onDismiss?: () => void;
  className?: string;
}> = ({ code, title, message, buttonText, targetUrl, onDismiss, className = '' }) => {
  const details = getIntegrationErrorDetails(code, title, message);
  const displayTitle = title || details.title;
  const displayMessage = message || details.message;
  const displayButton = buttonText || details.buttonText;
  const displayTarget = targetUrl || details.targetUrl;

  const renderIcon = () => {
    switch (details.iconType) {
      case 'google':
        return <Globe className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'rank':
        return <MapPin className="w-5 h-5 text-orange shrink-0" />;
      case 'gemini':
        return <Sparkles className="w-5 h-5 text-accent shrink-0" />;
      case 'whatsapp':
        return <MessageSquare className="w-5 h-5 text-green shrink-0" />;
      default:
        return <AlertCircle className="w-5 h-5 text-orange shrink-0" />;
    }
  };

  return (
    <div className={`bg-card-nested border border-border rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-background border border-border rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          {renderIcon()}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-white">{displayTitle}</h4>
            {details.subtitle && (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">
                {details.subtitle}
              </span>
            )}
          </div>
          <p className="text-xs text-muted leading-relaxed">{displayMessage}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
        <Link
          to={displayTarget}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/10 flex items-center gap-1.5"
        >
          {displayButton} <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted hover:text-white p-2 rounded-lg hover:bg-card transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default function ConfigurationRequired({
  code,
  title,
  subtitle,
  message,
  type = 'config',
  buttonText,
  targetUrl,
  onRetry,
  inline = false,
  onDismiss,
  className = '',
}: Props) {
  const details = getIntegrationErrorDetails(code, title, message);
  const displayTitle = title || details.title;
  const displaySubtitle = subtitle || details.subtitle;
  const displayMessage = message || details.message;
  const displayButton = buttonText || details.buttonText;
  const displayTarget = targetUrl || details.targetUrl;

  if (inline) {
    return (
      <IntegrationAlertBanner
        code={code}
        title={title}
        message={message}
        buttonText={buttonText}
        targetUrl={targetUrl}
        onDismiss={onDismiss}
        className={className}
      />
    );
  }

  const renderIcon = () => {
    switch (details.iconType) {
      case 'google':
        return <Globe className="w-10 h-10 text-amber-400" />;
      case 'rank':
        return <MapPin className="w-10 h-10 text-orange" />;
      case 'gemini':
        return <Sparkles className="w-10 h-10 text-accent" />;
      case 'whatsapp':
        return <MessageSquare className="w-10 h-10 text-green" />;
      default:
        return <Settings className="w-10 h-10 text-primary" />;
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[50vh] text-center px-4 py-8 ${className}`}>
      <div className="bg-card p-8 md:p-10 rounded-[2.5rem] border border-border max-w-lg shadow-2xl space-y-6 w-full animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-card-nested border border-border rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          {renderIcon()}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">{displayTitle}</h2>
          {displaySubtitle && (
            <div className="inline-block">
              <span className="text-xs font-bold text-amber-300 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-wider">
                {displaySubtitle}
              </span>
            </div>
          )}
          <p className="text-muted text-sm leading-relaxed max-w-md mx-auto pt-2">{displayMessage}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {type === 'quota' && onRetry && (
            <button
              onClick={onRetry}
              className="bg-card-nested hover:bg-card border border-border text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          )}

          <Link
            to={displayTarget}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {displayButton} <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
