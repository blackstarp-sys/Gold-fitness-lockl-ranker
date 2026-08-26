import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { 
  Building2, MapPin, Star, Zap, ChevronRight, CheckCircle2, 
  AlertCircle, Info, ArrowUpRight, ArrowDownRight, MoreHorizontal,
  ExternalLink, Sparkles, MessageSquare, Image as ImageIcon,
  CheckCircle, AlertTriangle, XCircle, UsersRound, X, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';

const TourOverlay = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0);
  const steps = [
    { title: 'Welcome to Dhanus Gold', description: 'Your all-in-one platform for dominating local Google Search and Maps.' },
    { title: 'AI Business Insights', description: 'Track your locations, reviews, and AI credits directly from the dashboard KPI cards.' },
    { title: 'Competitive Edge', description: 'Monitor how your business stacks up against local competitors in real-time.' },
    { title: 'Profile Audit', description: 'Use our circular audit score to identify missing data in your Google Business Profile.' },
    { title: 'Optimization Tasks', description: 'Follow our AI-generated task list to improve your local ranking daily.' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-background/60 animate-in fade-in duration-500">
      <div className="bg-card w-full max-w-md p-10 rounded-[2.5rem] border border-border shadow-2xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="w-24 h-24 text-primary" />
        </div>
        
        <div className="relative z-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-primary/30">
            <Zap className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-3xl font-black mb-4 tracking-tight">{steps[step].title}</h2>
          <p className="text-muted text-lg mb-10 leading-relaxed">{steps[step].description}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-primary' : 'w-2 bg-border'}`} />
              ))}
            </div>
            
            <button 
              onClick={() => {
                if (step < steps.length - 1) setStep(step + 1);
                else onComplete();
              }}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              {step < steps.length - 1 ? 'Next Step' : 'Finish Tour'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const KPIStat = ({ title, value, subtitle, icon: Icon, color }: any) => (
  <div className="bg-card rounded-2xl p-6 border border-border">
    <div className="flex items-center justify-between mb-4">
      <span className="text-[10px] font-bold text-muted tracking-widest uppercase">{title}</span>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <div className="space-y-1">
      <h3 className="text-3xl font-bold">{value}</h3>
      <p className="text-xs text-muted font-medium">{subtitle}</p>
    </div>
  </div>
);

const Dashboard = () => {
  const { user, apiFetch } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAt, setLoadingAt] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));
    setVerificationSent(true);
    setIsVerifying(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const today = new Intl.DateTimeFormat('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  }).format(new Date());

  const fetchSummary = async () => {
    setLoadingAt(true);
    setErrorInfo(null);
    try {
      const data = await apiFetch('/api/dashboard/summary');
      setSummary(data);
    } catch (err: any) {
      console.error(err);
      setErrorInfo({
        status: err.status,
        code: err.code,
        message: err.message
      });
    } finally {
      setLoadingAt(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loadingAt) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (errorInfo) {
    if (errorInfo.code === 'CONFIGURATION_REQUIRED') {
      return (
        <ConfigurationRequired 
          title="Configuration Required"
          message="This feature needs an external service/API before it can run."
        />
      );
    }
    if (errorInfo.status === 429 || errorInfo.code === 'RATE_LIMITED') {
      return (
        <ConfigurationRequired 
          title="Usage Limit Reached"
          message="This service has temporarily reached its request or quota limit. Try again later or review the integration plan/quota."
          type="quota"
          onRetry={fetchSummary}
        />
      );
    }
    if (errorInfo.code === 'UNAUTHORIZED' || errorInfo.status === 401) {
      return (
        <div className="p-8 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center max-w-lg mx-auto mt-12">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-muted text-sm mb-6">{errorInfo.message || 'Please log in again to view your dashboard.'}</p>
          <button onClick={() => window.location.reload()} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all">
            Sign In / Reload
          </button>
        </div>
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center max-w-lg mx-auto mt-12">
        <div className="w-12 h-12 bg-danger/20 text-danger rounded-xl flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Dashboard</h2>
        <p className="text-muted text-sm mb-2">{errorInfo.message || 'Failed to fetch dashboard'}</p>
        {errorInfo.code && (
          <p className="text-xs text-muted/60 font-mono mb-6">Error Code: {errorInfo.code}</p>
        )}
        <div className="flex justify-center gap-3">
          <button onClick={fetchSummary} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold transition-all">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] || 'User';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {showTour && <TourOverlay onComplete={() => {
        setShowTour(false);
        localStorage.setItem('dashboard_tour_completed', 'true');
      }} />}

      {/* Verification Banner */}
      {!summary?.user?.emailVerified && !verificationSent && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Verify Your Email</h3>
              <p className="text-sm text-muted">Verify your email address <span className="text-white font-medium">{summary?.user?.email}</span> to receive important alerts and notifications.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleVerify}
              disabled={isVerifying}
              className="flex-1 md:flex-none bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2"
            >
              {isVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
              {isVerifying ? 'Sending...' : 'Send Link'}
            </button>
          </div>
        </div>
      )}

      {verificationSent && (
        <div className="bg-green/10 border border-green/20 rounded-2xl p-6 flex items-center justify-between">
           <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green/20 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green" />
            </div>
            <p className="text-sm font-bold text-white">Verification link sent to {summary?.user?.email}. Please check your inbox.</p>
          </div>
          <button onClick={() => setVerificationSent(false)} className="text-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-card to-card border border-border p-10">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-muted font-bold text-sm mb-2">{today}</p>
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">{getGreeting()}, {firstName}!</h1>
            <div className="flex flex-wrap gap-3">
              {summary?.google?.status === 'CONNECTED_READY' || (summary?.google?.connected && !summary?.google?.quotaNotGranted && !summary?.google?.rateLimited && (summary?.google?.locations > 0 || summary?.google?.accounts > 0)) ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border bg-green/10 text-green border-green/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Google Business Connected
                </div>
              ) : summary?.google?.status === 'CONNECTED_API_PENDING' || summary?.google?.oauthConnected || summary?.google?.connected ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-300 border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Google Connected — API Access Pending
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border bg-danger/10 text-danger border-danger/20">
                  <XCircle className="w-3.5 h-3.5" /> Google Business Not Connected
                </div>
              )}

              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border ${
                summary?.google?.status === 'CONNECTED_READY' || (summary?.google?.connected && summary?.google?.locations > 0)
                  ? 'bg-blue/10 text-blue border-blue/20'
                  : summary?.google?.status === 'CONNECTED_API_PENDING' || summary?.google?.connected
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  : 'bg-orange/10 text-orange border-orange/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  summary?.google?.status === 'CONNECTED_READY' || (summary?.google?.connected && summary?.google?.locations > 0)
                    ? 'bg-blue animate-pulse'
                    : summary?.google?.status === 'CONNECTED_API_PENDING' || summary?.google?.connected
                    ? 'bg-amber-400'
                    : 'bg-orange'
                }`} />
                {summary?.google?.status === 'CONNECTED_READY' || (summary?.google?.connected && summary?.google?.locations > 0)
                  ? 'Live & Synced'
                  : summary?.google?.status === 'CONNECTED_API_PENDING' || summary?.google?.connected
                  ? 'API Access Pending'
                  : 'Sync Required'}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowTour(true)}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-2xl text-sm font-bold transition-all border border-white/10"
          >
            Take a Tour
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIStat 
          title="Business Accounts" 
          value={summary?.google?.accounts || 0} 
          subtitle="Google My Business accounts" 
          icon={Building2} 
          color="bg-primary" 
        />
        <KPIStat 
          title="Business Locations" 
          value={summary?.google?.locations || 0} 
          subtitle="Active Google Business locations" 
          icon={MapPin} 
          color="bg-blue" 
        />
        <KPIStat 
          title="Total Reviews" 
          value={summary?.reviews?.total || 0} 
          subtitle={`Avg rating: ${summary?.reviews?.averageRating || '0.0'} / 5 ★`} 
          icon={Star} 
          color="bg-orange" 
        />
        <KPIStat 
          title="AI Credits" 
          value={summary?.ai?.creditsRemaining || 0} 
          subtitle="Credits remaining" 
          icon={Zap} 
          color="bg-accent" 
        />
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Competitor Analysis */}
        <div className="lg:col-span-3 bg-card rounded-[2.5rem] p-8 border border-border flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Competitor Analysis</h2>
              <p className="text-muted text-sm">{summary?.business?.name || 'Loading location...'}</p>
            </div>
            <Link to="/competitors" className="flex items-center gap-1 text-sm font-bold text-primary hover:text-accent transition-colors">
              View Full Analysis <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-6 flex-1">
            <div className="bg-card-nested p-6 rounded-3xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Competitors Tracked</span>
                <UsersRound className="w-4 h-4 text-muted" />
              </div>
              <h4 className="text-2xl font-bold">{summary?.competitors?.tracked || 0}</h4>
              <div className="mt-4 w-full h-1 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min((summary?.competitors?.tracked || 0) * 10, 100)}%` }} />
              </div>
            </div>
            <div className="bg-card-nested p-6 rounded-3xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Total Reviews</span>
                <Star className="w-4 h-4 text-muted" />
              </div>
              <h4 className="text-2xl font-bold">{summary?.competitors?.totalReviews || 0}</h4>
              <div className="mt-4 w-full h-1 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-orange" style={{ width: '45%' }} />
              </div>
            </div>
            <div className="bg-card-nested p-6 rounded-3xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Average Rating</span>
                <Sparkles className="w-4 h-4 text-muted" />
              </div>
              <h4 className="text-2xl font-bold">{summary?.competitors?.averageRating || '0.0'} / 5</h4>
              <div className="mt-4 w-full h-1 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-green" style={{ width: `${(summary?.competitors?.averageRating || 0) * 20}%` }} />
              </div>
            </div>
            <div className="bg-card-nested p-6 rounded-3xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Photos Uploaded</span>
                <ImageIcon className="w-4 h-4 text-muted" />
              </div>
              <h4 className="text-2xl font-bold">{summary?.competitors?.photos ?? 'Data Provider Required'}</h4>
              <div className="mt-4 w-full h-1 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-blue" style={{ width: '10%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Profile Audit */}
        <div className="lg:col-span-2 bg-card rounded-[2.5rem] p-8 border border-border">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Google Profile Audit</h2>
              <p className="text-muted text-sm">Completeness score for your primary location</p>
            </div>
            <Link to="/google-audit" className="flex items-center gap-1 text-sm font-bold text-primary hover:text-accent transition-colors">
              Full Audit <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex flex-col items-center gap-8 py-4">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-card-nested stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
                <circle 
                  className="text-primary stroke-current" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="transparent" 
                  strokeDasharray={`${(summary?.profileAudit?.score || 0) * 2.51} 251`} 
                  transform="rotate(-90 50 50)" 
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black">{summary?.profileAudit?.score || 0}%</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  summary?.profileAudit?.status === 'Excellent' ? 'text-green' : 
                  summary?.profileAudit?.status === 'Good' ? 'text-blue' : 
                  summary?.profileAudit?.status === 'Needs Attention' ? 'text-orange' : 'text-danger'
                }`}>
                  {summary?.profileAudit?.status}
                </span>
              </div>
            </div>

            <div className="w-full space-y-4">
               <div className="flex items-center justify-between text-xs">
                 <span className="text-muted font-bold uppercase tracking-widest">Business Detail</span>
                 <span className="font-bold">Status</span>
               </div>
               <div className="space-y-3">
                 {[
                   { label: 'Business', status: summary?.business?.name ? 'PASS' : 'FAIL' },
                   { label: 'Category', status: summary?.business?.category ? 'PASS' : 'FAIL' },
                   { label: 'Photos', status: 'WARNING' },
                   { label: 'Reviews', status: summary?.reviews?.total > 0 ? 'PASS' : 'FAIL' },
                   { label: 'Owner Replies', status: summary?.reviews?.unanswered === 0 ? 'PASS' : 'WARNING' },
                 ].map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50">
                     <span className="text-sm font-medium">{item.label}</span>
                     {item.status === 'PASS' ? (
                       <div className="flex items-center gap-1.5 text-xs font-bold text-green">
                         <CheckCircle className="w-3.5 h-3.5" /> PASS
                       </div>
                     ) : item.status === 'WARNING' ? (
                       <div className="flex items-center gap-1.5 text-xs font-bold text-orange">
                         <AlertTriangle className="w-3.5 h-3.5" /> WARNING
                       </div>
                     ) : (
                       <div className="flex items-center gap-1.5 text-xs font-bold text-danger">
                         <XCircle className="w-3.5 h-3.5" /> FAIL
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
        {/* Performance */}
        <div className="bg-card rounded-[2rem] p-8 border border-border">
          <h3 className="text-xl font-bold mb-6 flex items-center justify-between">
            Google Performance
            <div className="p-1 bg-card-nested rounded-lg border border-border">
              <MoreHorizontal className="w-4 h-4 text-muted" />
            </div>
          </h3>
          <div className="space-y-6">
            {[
              { label: 'Profile Views', value: summary?.performance?.profileViews, trend: '+12%', up: true },
              { label: 'Searches', value: summary?.performance?.searches, trend: '+5%', up: true },
              { label: 'Website Clicks', value: summary?.performance?.websiteClicks, trend: '-2%', up: false },
              { label: 'Calls', value: summary?.performance?.calls, trend: '+8%', up: true },
            ].map((perf, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{perf.label}</p>
                  <p className="text-xl font-bold">{perf.value || 0}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${perf.up ? 'bg-green/10 text-green' : 'bg-danger/10 text-danger'}`}>
                  {perf.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {perf.trend}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="bg-card rounded-[2rem] p-8 border border-border flex flex-col">
          <h3 className="text-xl font-bold mb-6 flex items-center justify-between">
            Recent Reviews
            <Link to="/reviews" className="text-xs font-bold text-primary hover:underline">View All</Link>
          </h3>
          <div className="space-y-4 flex-1">
            {summary?.recentReviews?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted opacity-50">
                <Star className="w-12 h-12 mb-2" />
                <p className="text-sm font-medium">No reviews yet</p>
              </div>
            ) : (
              summary?.recentReviews?.map((review: any) => (
                <div key={review.id} className="p-4 bg-card-nested rounded-2xl border border-border/50">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-sm font-bold truncate">{review.reviewerName}</span>
                     <div className="flex gap-0.5">
                       {[...Array(5)].map((_, i) => (
                         <Star key={i} className={`w-2.5 h-2.5 ${i < review.starRating ? 'text-orange fill-orange' : 'text-muted'}`} />
                       ))}
                     </div>
                   </div>
                   <p className="text-xs text-muted line-clamp-2 italic">"{review.comment || 'No text'}"</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Optimization Tasks */}
        <div className="bg-card rounded-[2rem] p-8 border border-border flex flex-col">
          <h3 className="text-xl font-bold mb-6">Optimization Tasks</h3>
          <div className="space-y-4 flex-1">
            {summary?.optimizationTasks?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted opacity-50">
                <CheckCircle2 className="w-12 h-12 mb-2" />
                <p className="text-sm font-medium">Everything looks good!</p>
              </div>
            ) : (
              summary?.optimizationTasks?.map((task: any, idx: number) => (
                <div key={idx} className="p-4 bg-card-nested rounded-2xl border border-border/50 flex items-start gap-3">
                   <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${task.priority === 'HIGH' ? 'bg-danger' : task.priority === 'MEDIUM' ? 'bg-orange' : 'bg-blue'}`} />
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-bold text-white mb-1">{task.title}</p>
                     <div className="flex items-center justify-between mt-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          task.priority === 'HIGH' ? 'bg-danger/10 text-danger' : 
                          task.priority === 'MEDIUM' ? 'bg-orange/10 text-orange' : 'bg-blue/10 text-blue'
                        }`}>
                          {task.priority}
                        </span>
                        <button className="text-[10px] font-bold text-primary hover:underline">Fix Now</button>
                     </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
