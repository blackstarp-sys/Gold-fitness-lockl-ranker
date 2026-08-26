import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Sparkles, Send, Loader2, CheckCircle, MessageSquareWarning, X, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { IntegrationAlertBanner } from '../components/ConfigurationRequired.tsx';
import GoogleReviewQrModal from '../components/GoogleReviewQrModal.tsx';

export default function Reviews() {
  const { t, i18n } = useTranslation();
  const { apiFetch } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'replied'>('pending');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ code?: string; message?: string } | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    try {
      const data = await apiFetch('/api/reviews');
      setReviews(data);
      
      const loadedDrafts: Record<string, string> = {};
      data.forEach((r: any) => {
        if (r.aiDraftReply) loadedDrafts[r.id] = r.aiDraftReply;
      });
      setDrafts(loadedDrafts);
    } catch (error: any) {
      setErrorInfo({
        code: error.code,
        message: error.message || 'Action failed'
      });
    }
  }

  async function syncGoogle() {
    setIsSyncing(true);
    setErrorInfo(null);
    try {
      await apiFetch('/api/sync', { method: 'POST' });
      await fetchReviews();
    } catch (error: any) {
      if (error.code === 'GOOGLE_API_QUOTA_PENDING' || error.code === 'GOOGLE_API_QUOTA_NOT_GRANTED') {
        setErrorInfo({
          code: 'GOOGLE_API_QUOTA_PENDING',
          message: 'Your Google Business Profile is connected, but Google API access/quota is still pending approval.'
        });
      } else if (error.code === 'QUOTA_TEMPORARILY_EXCEEDED' || error.code === 'GOOGLE_RATE_LIMITED' || error.status === 429) {
        setErrorInfo({
          code: 'GOOGLE_API_QUOTA_PENDING',
          message: 'Your Google Business Profile is connected, but Google API access/quota is still pending approval.'
        });
      } else if (error.code === 'GOOGLE_NOT_CONNECTED') {
        setErrorInfo({
          code: 'GOOGLE_NOT_CONNECTED',
          message: 'Connect your Google Business Profile to sync reviews.'
        });
      } else if (error.code === 'GOOGLE_REAUTH_REQUIRED') {
        setErrorInfo({
          code: 'GOOGLE_REAUTH_REQUIRED',
          message: 'Google authorization has expired. Please reconnect your account in Settings.'
        });
      } else {
        setErrorInfo({
          code: error.code,
          message: error.message || 'Failed to sync Google reviews'
        });
      }
    } finally {
      setIsSyncing(false);
    }
  }

  async function generateAIReply(review: any) {
    setLoadingId(review.id);
    setErrorInfo(null);
    try {
      const data = await apiFetch(`/api/reviews/${review.id}/generate-reply`, {
        method: 'POST',
        body: JSON.stringify({ language: i18n.language }),
      });
      if (data.reply) {
        setDrafts(prev => ({ ...prev, [review.id]: data.reply }));
      }
    } catch (error: any) {
      setErrorInfo({
        code: error.code || 'GEMINI_CONFIGURATION_REQUIRED',
        message: error.message || "Configure Gemini API access to use AI generation features."
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function publishReply(review: any) {
    const draftText = drafts[review.id];
    if (!draftText) return;
    
    setPublishingId(review.id);
    setErrorInfo(null);
    try {
      const data = await apiFetch(`/api/reviews/${review.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ replyText: draftText }),
      });
      
      if (data.success) {
        setDrafts(prev => {
          const newDrafts = { ...prev };
          delete newDrafts[review.id];
          return newDrafts;
        });
        fetchReviews();
      }
    } catch (error: any) {
      setErrorInfo({
        code: error.code,
        message: error.message || "Failed to publish to Google."
      });
    } finally {
      setPublishingId(null);
    }
  }

  const filteredReviews = reviews.filter(r => 
    activeTab === 'pending' ? r.replyStatus === 'PENDING' : r.replyStatus === 'REPLIED'
  );

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Engine</h1>
          <p className="text-muted text-sm mt-1">Manage and auto-reply to your Google My Business reviews.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowQrModal(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black px-5 py-2.5 rounded-2xl text-sm font-extrabold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <QrCode className="w-4 h-4" />
            Print Review QR
          </button>

          <button 
            onClick={syncGoogle}
            disabled={isSyncing}
            className="bg-card border border-border hover:bg-card-nested text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Star className="w-4 h-4 text-orange fill-orange" />}
            {isSyncing ? 'Syncing...' : 'Sync Latest Reviews'}
          </button>
        </div>
      </div>

      {errorInfo && (
        <IntegrationAlertBanner
          code={errorInfo.code}
          message={errorInfo.message}
          onDismiss={() => setErrorInfo(null)}
        />
      )}

      <div className="flex space-x-4">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted hover:text-white border border-border'}`}
        >
          Needs Reply
        </button>
        <button 
          onClick={() => setActiveTab('replied')}
          className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'replied' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted hover:text-white border border-border'}`}
        >
          Replied
        </button>
      </div>

      <div className="space-y-6">
        {filteredReviews.length === 0 && (
          <div className="bg-card rounded-[2.5rem] border border-border p-20 text-center">
            <Star className="w-12 h-12 text-muted mx-auto mb-4 opacity-20" />
            <p className="text-muted font-bold">No reviews found in this category.</p>
          </div>
        )}
        
        {filteredReviews.map(review => (
          <div key={review.id} className="bg-card rounded-[2.5rem] border border-border p-8 hover:border-primary/30 transition-all group">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                {review.reviewerPhoto ? (
                  <img src={review.reviewerPhoto} alt="Reviewer" className="w-12 h-12 rounded-2xl shadow-sm border border-border" />
                ) : (
                  <div className="h-12 w-12 bg-card-nested rounded-2xl flex items-center justify-center font-bold text-muted border border-border">
                    {review.reviewerName?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white group-hover:text-primary transition-colors">{review.reviewerName}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < review.starRating ? 'text-orange fill-orange' : 'text-muted/30'}`} />
                    ))}
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest ml-3">
                      {review.reviewTimestamp ? new Date(review.reviewTimestamp).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                </div>
              </div>
              {review.needsAttention && (
                <span className="flex items-center gap-2 text-[10px] font-bold text-danger bg-danger/10 px-3 py-1.5 rounded-xl border border-danger/20">
                  <MessageSquareWarning className="w-3.5 h-3.5" /> NEEDS ATTENTION
                </span>
              )}
            </div>
            
            <p className="mt-6 text-slate-300 font-medium leading-relaxed">
              {review.comment || <span className="italic text-muted/50">No text provided by customer.</span>}
            </p>

            {review.replyStatus === 'PENDING' && (
              <div className="mt-8 bg-card-nested rounded-3xl p-6 border border-border">
                {!drafts[review.id] ? (
                  <button 
                    onClick={() => generateAIReply(review)}
                    disabled={loadingId === review.id}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10"
                  >
                    {loadingId === review.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate AI Reply
                  </button>
                ) : (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> AI Generated Draft
                    </label>
                    <textarea
                      value={drafts[review.id]}
                      onChange={(e) => setDrafts({...drafts, [review.id]: e.target.value})}
                      className="w-full min-h-[120px] p-4 text-sm font-medium bg-background border border-border rounded-2xl text-slate-100 shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => publishReply(review)}
                        disabled={publishingId === review.id}
                        className="flex items-center gap-2 px-6 py-2.5 bg-green hover:bg-green/90 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-green/10"
                      >
                        {publishingId === review.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Publish to Google
                      </button>
                      <button 
                        onClick={() => generateAIReply(review)}
                        disabled={loadingId === review.id}
                        className="px-6 py-2.5 text-sm font-bold text-muted hover:text-white bg-card hover:bg-card-nested rounded-2xl transition-all flex items-center gap-2 border border-border shadow-sm"
                      >
                         {loadingId === review.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                         Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {review.replyStatus === 'REPLIED' && (
              <div className="mt-8 bg-green/5 rounded-3xl p-6 border border-green/10">
                <div className="flex items-center gap-2 mb-3 text-green font-bold text-[10px] uppercase tracking-widest">
                  <CheckCircle className="w-4 h-4" />
                  Replied on Google
                </div>
                <p className="text-sm text-slate-400 italic font-medium">
                  "{review.publishedReply}"
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <GoogleReviewQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        businessName="Dhanu's Gold Fitness"
      />
    </div>
  );
}
