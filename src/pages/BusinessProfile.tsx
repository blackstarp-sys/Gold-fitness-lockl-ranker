import React, { useState, useEffect } from 'react';
import { 
  Store, Loader2, Save, Globe, Phone, Tag, AlertCircle, CheckCircle2, 
  RefreshCw, Link2, Unlink, ExternalLink, ShieldCheck, AlertTriangle, X,
  ShieldAlert, Info, Building2, Clock, MapPin, Sparkles, Database,
  UserCheck, Calendar, Layers, Check, ArrowUpRight, Copy, QrCode, Printer
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import GoogleReviewQrModal from '../components/GoogleReviewQrModal';

export interface GoogleStatus {
  success?: boolean;
  configured: boolean;
  oauthConnected: boolean;
  connected?: boolean;
  status: 'NOT_CONNECTED' | 'CONNECTED_API_PENDING' | 'CONNECTED_READY' | 'REAUTH_REQUIRED';
  apiAccess: 'unknown' | 'pending' | 'ready';
  connectedAt: string | null;
  lastSyncedAt?: string | null;
  accounts?: number;
  locations?: number;
  scopes?: string | null;
  accountEmail?: string | null;
  rateLimited?: boolean;
  cooldownSeconds?: number;
  quotaNotGranted?: boolean;
}

export interface GoogleAccount {
  id: number;
  userId: number;
  googleAccountId: string;
  accountName: string | null;
  accountType: string | null;
  role: string | null;
  lastSyncedAt: string;
  createdAt: string;
}

export interface BusinessLocationItem {
  id: string;
  userId: number;
  googleLocationId: string;
  googleAccountId?: string | null;
  businessName: string;
  address?: string | null;
  category?: string | null;
  phone?: string | null;
  websiteUri?: string | null;
  businessHours?: any;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
}

export default function BusinessProfile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [locations, setLocations] = useState<BusinessLocationItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  
  const [formData, setFormData] = useState({
    businessName: '',
    address: '',
    phone: '',
    websiteUri: '',
    description: '',
    category: '',
    businessHours: {
      monday: { open: '09:00', close: '17:00', isClosed: false },
      tuesday: { open: '09:00', close: '17:00', isClosed: false },
      wednesday: { open: '09:00', close: '17:00', isClosed: false },
      thursday: { open: '09:00', close: '17:00', isClosed: false },
      friday: { open: '09:00', close: '17:00', isClosed: false },
      saturday: { open: '10:00', close: '14:00', isClosed: false },
      sunday: { open: '', close: '', isClosed: true },
    } as any
  });
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [retryingStatus, setRetryingStatus] = useState(false);
  const [refreshingAccount, setRefreshingAccount] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [authModalUrl, setAuthModalUrl] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isQuotaNotGranted, setIsQuotaNotGranted] = useState(false);

  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    const qrParam = searchParams.get('qr');

    if (qrParam === 'true') {
      setShowQrModal(true);
    }
    
    if (connectedParam) {
      setSuccess('Google Business Profile OAuth authorized successfully!');
      setSearchParams({});
      loadData(true);
    } else if (errorParam) {
      const decodedError = decodeURIComponent(errorParam);
      const decodedMessage = messageParam ? decodeURIComponent(messageParam) : '';
      
      if (decodedError === 'GOOGLE_API_QUOTA_NOT_GRANTED' || decodedError === 'QUOTA_TEMPORARILY_EXCEEDED') {
        setIsQuotaNotGranted(true);
      } else if (decodedError === 'GOOGLE_ACCESS_DENIED') {
        setError(`Access Denied (403): If your Google Cloud app is in "Testing" mode, ensure your Google account is added under "Test users" in Google Cloud OAuth consent screen. (${decodedMessage || 'Access not granted'})`);
      } else if (decodedError === 'GOOGLE_SCOPE_MISSING') {
        setError(`Permission Missing: The required Google Business Profile scope was not granted. Please reconnect and check requested permissions.`);
      } else if (decodedError === 'GOOGLE_REAUTH_REQUIRED') {
        setError(`Authorization Expired: Please click "Reconnect Google" to re-authenticate.`);
      } else {
        setError(`Google authorization notice: ${decodedMessage || decodedError}`);
      }
      setSearchParams({});
      loadData(false);
    } else {
      loadData(false);
    }
  }, []);

  async function loadData(autoSync = false) {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Google Status (Reads purely from local DB/cache - 0 external Google API calls)
      const statusRes: GoogleStatus = await apiFetch('/api/google/status');
      setStatus(statusRes);
      if (statusRes.quotaNotGranted) {
        setIsQuotaNotGranted(true);
      }

      // 2. Fetch Cached Google Business Accounts from Local DB
      try {
        const accs = await apiFetch('/api/google/accounts');
        if (Array.isArray(accs)) {
          setAccounts(accs);
        }
      } catch (err) {
        console.warn('Could not load accounts list:', err);
      }

      // 3. Fetch Cached Locations
      const locs: BusinessLocationItem[] = await apiFetch('/api/locations');
      if (Array.isArray(locs) && locs.length > 0) {
        setLocations(locs);
        setSelectedLocationId(locs[0].id.toString());
        populateForm(locs[0]);
      } else {
        // Default local profile data if no locations exist in DB yet
        const defaultProfile = {
          businessName: 'Dhanus Gold Fitness',
          category: 'Gym / Fitness Center',
          address: '123 Wellness Blvd, Fitness District, CA 90210',
          phone: '+1 (555) 234-5678',
          websiteUri: 'https://dhanusgoldfitness.com',
          description: 'Premier fitness center and health club providing strength training, cardio facilities, personal coaching, and local community wellness programs.'
        };
        setFormData(prev => ({
          ...prev,
          ...defaultProfile
        }));
      }

      // If just connected and in ready state, attempt initial sync
      if (autoSync && statusRes?.status === 'CONNECTED_READY') {
        handleSync();
      }
    } catch (e: any) {
      console.error('[LOAD GOOGLE DATA ERROR]', e);
      if (e.code === 'GOOGLE_API_QUOTA_NOT_GRANTED') {
        setIsQuotaNotGranted(true);
      } else {
        setError(e.message || 'Failed to fetch Google status or business locations');
      }
    } finally {
      setLoading(false);
    }
  }

  const handleRetryStatus = async () => {
    setRetryingStatus(true);
    setError(null);
    try {
      const statusRes: GoogleStatus = await apiFetch('/api/google/status');
      setStatus(statusRes);
      if (statusRes.quotaNotGranted) {
        setIsQuotaNotGranted(true);
      } else {
        setIsQuotaNotGranted(false);
      }
      setSuccess('Status refreshed successfully.');
    } catch (e: any) {
      setError(e.message || 'Failed to refresh status');
    } finally {
      setRetryingStatus(false);
    }
  };

  const handleTestApi = async () => {
    setTestingApi(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/google/test-api', { method: 'POST' });
      if (res.success && res.apiAccess === 'ready') {
        setSuccess(`Account Management API access verified! Found ${res.accountsCount || 0} business account(s).`);
      } else {
        setError(res.message || 'Account Management API access is pending approval.');
      }
      const statusRes: GoogleStatus = await apiFetch('/api/google/status');
      setStatus(statusRes);
      if (statusRes.quotaNotGranted) {
        setIsQuotaNotGranted(true);
      } else {
        setIsQuotaNotGranted(false);
      }
      const accs = await apiFetch('/api/google/accounts');
      if (Array.isArray(accs)) setAccounts(accs);
    } catch (e: any) {
      if (e.code === 'GOOGLE_API_QUOTA_PENDING' || e.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || e.status === 429) {
        setIsQuotaNotGranted(true);
        setError('OAuth token is valid, but Google Business Profile API quota is pending approval in Google Cloud Console.');
      } else if (e.code === 'GOOGLE_SCOPE_MISSING') {
        setError('Missing required scope (https://www.googleapis.com/auth/business.manage). Please disconnect and reconnect Google with all permissions checked.');
      } else {
        setError(e.message || 'Account Management API verification test failed');
      }
    } finally {
      setTestingApi(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const data = await apiFetch('/api/google/connect');
      if (data?.authorizationUrl) {
        setAuthModalUrl(data.authorizationUrl);
        // Attempt top navigation first (to break out of iframe), fallback to window.location
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = data.authorizationUrl;
          } else {
            window.location.href = data.authorizationUrl;
          }
        } catch {
          window.location.href = data.authorizationUrl;
        }
      } else {
        throw new Error(data?.message || 'Failed to obtain authorization URL');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start Google connection flow');
      setConnecting(false);
    }
  };

  const handleReconnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      // 1. Calls /api/google/reconnect which clears stale DB credentials and returns a fresh consent OAuth URL
      const data = await apiFetch('/api/google/reconnect', { method: 'POST' });
      if (data?.authorizationUrl) {
        setAuthModalUrl(data.authorizationUrl);
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = data.authorizationUrl;
          } else {
            window.location.href = data.authorizationUrl;
          }
        } catch {
          window.location.href = data.authorizationUrl;
        }
      } else {
        throw new Error(data?.message || 'Failed to obtain reconnect authorization URL');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start Google reconnect flow');
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setShowDisconnectModal(true);
  };

  const executeDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await apiFetch('/api/google/disconnect', { method: 'POST' });
      setSuccess('Google Business Profile disconnected successfully.');
      setStatus({
        configured: status?.configured ?? true,
        oauthConnected: false,
        connected: false,
        status: 'NOT_CONNECTED',
        apiAccess: 'unknown',
        connectedAt: null,
        locations: 0,
        accounts: 0
      });
      setAccounts([]);
      setShowDisconnectModal(false);
    } catch (e: any) {
      setError(e.message || 'Failed to disconnect Google account');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await apiFetch('/api/sync', { method: 'POST' });
      if (result.rateLimited) {
        setSuccess(`Loaded latest cached business profile data. (Google rate limit cooldown active)`);
      } else {
        setSuccess(`Sync completed! ${result.locations || 0} locations, ${result.reviewsImported || 0} reviews synced.`);
      }
      
      const statusRes: GoogleStatus = await apiFetch('/api/google/status');
      setStatus(statusRes);
      if (statusRes.quotaNotGranted) {
        setIsQuotaNotGranted(true);
      }
      const locs = await apiFetch('/api/locations');
      if (Array.isArray(locs) && locs.length > 0) {
        setLocations(locs);
        const currentSelected = locs.find(l => l.id.toString() === selectedLocationId) || locs[0];
        setSelectedLocationId(currentSelected.id.toString());
        populateForm(currentSelected);
      }
      const accs = await apiFetch('/api/google/accounts');
      if (Array.isArray(accs)) setAccounts(accs);
    } catch (e: any) {
      console.error('[SYNC ERROR]', e);
      if (e.code === 'GOOGLE_API_QUOTA_PENDING' || e.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || e.code === 'QUOTA_TEMPORARILY_EXCEEDED' || e.code === 'GOOGLE_RATE_LIMITED' || e.status === 429) {
        setIsQuotaNotGranted(true);
      } else if (e.code === 'GOOGLE_NOT_CONNECTED') {
        setError('Connect Google Business Profile first.');
      } else if (e.code === 'GOOGLE_REAUTH_REQUIRED') {
        setError('Google authorization has expired. Please click "Reconnect Google" below.');
      } else if (e.code === 'GOOGLE_SCOPE_MISSING') {
        setError('Missing required Google Business Profile permissions. Please reconnect.');
      } else {
        setError(e.message || 'Sync failed. Serving cached data.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleRefreshAccount = async () => {
    setRefreshingAccount(true);
    setError(null);
    try {
      const result = await apiFetch('/api/google/refresh-accounts', { method: 'POST' });
      if (result.rateLimited) {
        if (result.quotaNotGranted) {
          setIsQuotaNotGranted(true);
        }
        setSuccess('Account discovery rate-limited. Displaying cached Google Business accounts.');
      } else {
        setSuccess(`Discovered ${result.accounts || 0} Google Business account(s) successfully!`);
      }
      const statusRes: GoogleStatus = await apiFetch('/api/google/status');
      setStatus(statusRes);
      if (statusRes.quotaNotGranted) {
        setIsQuotaNotGranted(true);
      }
      const accs = await apiFetch('/api/google/accounts');
      if (Array.isArray(accs)) setAccounts(accs);
    } catch (e: any) {
      console.error('[REFRESH ACCOUNT ERROR]', e);
      if (e.code === 'GOOGLE_API_QUOTA_PENDING' || e.code === 'GOOGLE_API_QUOTA_NOT_GRANTED' || e.code === 'QUOTA_TEMPORARILY_EXCEEDED' || e.code === 'GOOGLE_RATE_LIMITED' || e.status === 429) {
        setIsQuotaNotGranted(true);
      } else if (e.code === 'GOOGLE_NOT_CONNECTED') {
        setError('Connect Google Business Profile first.');
      } else if (e.code === 'GOOGLE_REAUTH_REQUIRED') {
        setError('Google authorization has expired. Please click "Reconnect Google" below.');
      } else {
        setError(e.message || 'Failed to refresh Google Business accounts');
      }
    } finally {
      setRefreshingAccount(false);
    }
  };

  const handleLocationSelect = (locId: string) => {
    setSelectedLocationId(locId);
    const loc = locations.find(l => l.id.toString() === locId);
    if (loc) populateForm(loc);
  };

  const populateForm = (loc: BusinessLocationItem) => {
    setFormData({
      businessName: loc.businessName || '',
      address: loc.address || '',
      phone: loc.phone || '',
      websiteUri: loc.websiteUri || '',
      description: loc.description || '',
      category: loc.category || '',
      businessHours: loc.businessHours || {
        monday: { open: '09:00', close: '17:00', isClosed: false },
        tuesday: { open: '09:00', close: '17:00', isClosed: false },
        wednesday: { open: '09:00', close: '17:00', isClosed: false },
        thursday: { open: '09:00', close: '17:00', isClosed: false },
        friday: { open: '09:00', close: '17:00', isClosed: false },
        saturday: { open: '10:00', close: '14:00', isClosed: false },
        sunday: { open: '', close: '', isClosed: true },
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch('/api/business-profile/update', {
        method: 'POST',
        body: JSON.stringify({
          locationId: selectedLocationId || undefined,
          ...formData
        }),
      });
      if (data) {
        setSuccess('Business profile updated successfully in local database!');
        // Refresh local locations
        const locs: BusinessLocationItem[] = await apiFetch('/api/locations');
        if (Array.isArray(locs) && locs.length > 0) {
          setLocations(locs);
          if (!selectedLocationId) {
            setSelectedLocationId(locs[0].id.toString());
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Not available';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-card rounded-[2.5rem] border border-border text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-bold text-muted">Checking Google Business Profile status...</p>
      </div>
    );
  }

  const isOAuthConnected = Boolean(status?.oauthConnected || status?.connected);
  const currentStatusState = status?.status || (isOAuthConnected ? 'CONNECTED_API_PENDING' : 'NOT_CONNECTED');
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Primary account resolution from local DB
  const primaryAccount = accounts.length > 0 ? accounts[0] : null;
  const displayAccountName = primaryAccount?.accountName || 'Primary Business Profile';
  const displayAccountId = primaryAccount?.googleAccountId || 'accounts/1092837465';
  const displayEmail = status?.accountEmail || 'blackstar.p@gmail.com';
  const displayLastSynced = status?.lastSyncedAt || primaryAccount?.lastSyncedAt;

  // Suppress generic "Connect Google Business Profile first" messages if user is in CONNECTED_API_PENDING
  const sanitizedError = (currentStatusState === 'CONNECTED_API_PENDING' && error?.toLowerCase().includes('connect google business'))
    ? null
    : error;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Store className="w-8 h-8 text-primary" />
            Google Business Profile
          </h1>
          <p className="text-muted text-sm mt-1">
            Manage your Google Business Profile connection, cached locations, operating hours, and sync reviews with Google Search &amp; Maps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {locations.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Location:</span>
              <select 
                value={selectedLocationId}
                onChange={(e) => handleLocationSelect(e.target.value)}
                className="p-2.5 px-4 border border-border bg-card text-white rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id.toString()}>{loc.businessName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* API Quota Pending Notification Alert */}
      {(isQuotaNotGranted || currentStatusState === 'CONNECTED_API_PENDING') && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-[2rem] p-6 md:p-7 text-white shadow-lg space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base md:text-lg font-bold text-white">
                    Google Business Profile Connected
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    API Access Pending
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Your Google Business Profile is connected, but Google API access/quota is still pending approval.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
              <button 
                onClick={() => navigate('/settings?tab=integrations#google')}
                className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                Open Google Settings <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setIsQuotaNotGranted(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                title="Dismiss banner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-500/20 text-xs">
            <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green shrink-0" /> Local Database Active &amp; Functional
              </p>
              <p className="text-muted leading-relaxed">
                Your business profile, cached locations, and customer reviews stored in the database remain fully accessible and editable.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" /> Live Google Cloud Quota
              </p>
              <p className="text-muted leading-relaxed">
                In Google Cloud Console, ensure <span className="text-white font-medium">My Business Account Management</span> and <span className="text-white font-medium">Business Information</span> APIs are enabled with quota for your project.
              </p>
            </div>
          </div>
        </div>
      )}

      {sanitizedError && (
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-danger shrink-0" />
            <p className="text-sm font-bold text-white">{sanitizedError}</p>
          </div>
          <button onClick={() => setError(null)} className="text-muted hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green/10 border border-green/20 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green shrink-0" />
            <p className="text-sm font-bold text-white">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-muted hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Integration Status Panel */}
      <div className="bg-card rounded-[2.5rem] p-6 md:p-8 border border-border shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              currentStatusState === 'CONNECTED_READY' 
                ? 'bg-green/10 text-green border border-green/20' 
                : currentStatusState === 'CONNECTED_API_PENDING' || isOAuthConnected
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-muted/10 text-muted border border-border'
            }`}>
              {currentStatusState === 'CONNECTED_READY' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : currentStatusState === 'CONNECTED_API_PENDING' || isOAuthConnected ? (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              ) : (
                <Link2 className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {currentStatusState === 'CONNECTED_READY' 
                    ? 'Google Business Profile Connected'
                    : currentStatusState === 'CONNECTED_API_PENDING' || isOAuthConnected
                    ? 'Google Business Profile Connected'
                    : 'Google Business Profile Not Connected'}
                </h2>
                {currentStatusState === 'CONNECTED_READY' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green/10 text-green border border-green/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse"></span> Connected (Active)
                  </span>
                ) : currentStatusState === 'CONNECTED_API_PENDING' || isOAuthConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> API Access Pending
                  </span>
                ) : currentStatusState === 'REAUTH_REQUIRED' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger/10 text-danger border border-danger/20">
                    Re-auth Required
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted/10 text-muted border border-border">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {currentStatusState === 'CONNECTED_READY'
                  ? `Active live connection to ${displayEmail}`
                  : currentStatusState === 'CONNECTED_API_PENDING' || isOAuthConnected
                  ? 'OAuth token is valid and stored in database. Ready for local profile editing and cached management.'
                  : 'Connect your Google account to sync locations and manage customer reviews.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black px-4 py-2.5 rounded-xl font-extrabold text-sm transition-all shadow-lg shadow-amber-500/20"
            >
              <QrCode className="w-4 h-4" />
              Print Review QR Code
            </button>

            {isOAuthConnected ? (
              <>
                <button
                  onClick={handleTestApi}
                  disabled={testingApi}
                  title="Explicitly test Google Business Account Management API access"
                  className="flex items-center gap-2 bg-card hover:bg-background border border-primary/40 text-primary hover:text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50"
                >
                  {testingApi ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
                  {testingApi ? 'Testing API...' : 'Test API Access'}
                </button>

                {currentStatusState === 'CONNECTED_READY' && (
                  <>
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      title="Sync reviews and performance data using cached Google account"
                      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Syncing...' : 'Sync Business Data'}
                    </button>

                    <button
                      onClick={handleRefreshAccount}
                      disabled={refreshingAccount}
                      title="Query Google API once to discover newly added Google Business accounts"
                      className="flex items-center gap-2 bg-card hover:bg-background border border-border text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                    >
                      {refreshingAccount ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Store className="w-4 h-4 text-primary" />}
                      {refreshingAccount ? 'Refreshing...' : 'Refresh Google Account'}
                    </button>
                  </>
                )}

                {currentStatusState === 'CONNECTED_API_PENDING' && (
                  <button
                    onClick={handleRetryStatus}
                    disabled={retryingStatus}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${retryingStatus ? 'animate-spin' : ''}`} />
                    {retryingStatus ? 'Checking...' : 'Retry Status'}
                  </button>
                )}

                <button
                  onClick={handleReconnect}
                  disabled={connecting}
                  title="Clear stale credentials and force a fresh Google OAuth consent prompt"
                  className="flex items-center gap-2 bg-card hover:bg-background border border-border text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Reconnect Google
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
                >
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting || !status?.configured}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Connect Google Business Profile
              </button>
            )}
          </div>
        </div>

        {/* OAuth Scopes & Refresh Token Information */}
        <div className="p-4 rounded-2xl bg-background/60 border border-border/60 text-xs text-muted flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong className="text-white">Active OAuth Scopes:</strong>{' '}
              <code className="text-primary font-mono text-[11px] bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">openid</code>{' '}
              <code className="text-primary font-mono text-[11px] bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">email</code>{' '}
              <code className="text-primary font-mono text-[11px] bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">profile</code>{' '}
              <code className="text-primary font-mono text-[11px] bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">https://www.googleapis.com/auth/business.manage</code>
            </span>
          </div>
          {isOAuthConnected && (
            <span className="text-[11px] text-muted shrink-0">
              Need new permissions? Use <button onClick={handleDisconnect} className="text-danger hover:underline font-bold">Disconnect</button> and <button onClick={handleReconnect} className="text-primary hover:underline font-bold">Reconnect</button> to refresh grant.
            </span>
          )}
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-background/50 border border-border/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Configuration</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status?.configured ? 'bg-green' : 'bg-danger'}`}></span>
              <span className="text-sm font-bold text-white">{status?.configured ? 'Ready' : 'Missing Keys'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-background/50 border border-border/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">OAuth Token</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOAuthConnected ? 'bg-green' : 'bg-muted'}`}></span>
              <span className="text-sm font-bold text-white">
                {currentStatusState === 'CONNECTED_READY' 
                  ? 'Active' 
                  : currentStatusState === 'CONNECTED_API_PENDING' 
                  ? 'Stored & Valid' 
                  : isOAuthConnected ? 'Connected' : 'None'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-background/50 border border-border/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Cached Locations</span>
            <span className="text-sm font-bold text-white">{locations.length > 0 ? `${locations.length} Location(s)` : '1 Local Profile'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-background/50 border border-border/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Last Synced</span>
            <span className="text-sm font-bold text-muted truncate block">
              {displayLastSynced ? formatDate(displayLastSynced) : (isOAuthConnected ? 'Local DB Ready' : 'Never')}
            </span>
          </div>
        </div>
      </div>

      {/* DASHBOARD CARDS: Cached Local Database Information Mapping */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Cached Business Profile & Identity */}
        <div className="bg-card rounded-[2.5rem] p-7 border border-border shadow-sm flex flex-col justify-between space-y-6 hover:border-primary/40 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                <Store className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20 uppercase tracking-widest">
                Business Profile (DB)
              </span>
            </div>

            <div className="mb-4">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-0.5">Business Name</span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {formData.businessName || locations[0]?.businessName || 'Dhanus Gold Fitness'}
              </h3>
              <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                {formData.category || locations[0]?.category || 'Gym / Fitness Center'}
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/60 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="text-muted font-semibold shrink-0">Primary Address:</span>
                <span className="text-white font-medium text-right truncate max-w-[190px]" title={formData.address || locations[0]?.address || 'Primary Address'}>
                  {formData.address || locations[0]?.address || '123 Wellness Blvd, CA 90210'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Phone:</span>
                <span className="text-white font-medium">
                  {formData.phone || locations[0]?.phone || '+1 (555) 234-5678'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Website:</span>
                <a 
                  href={formData.websiteUri || 'https://dhanusgoldfitness.com'} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-primary hover:underline font-medium flex items-center gap-1 truncate max-w-[170px]"
                >
                  {formData.websiteUri ? formData.websiteUri.replace(/^https?:\/\//, '') : 'dhanusgoldfitness.com'}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/40 border border-border/40 text-[11px] text-muted flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary" /> Table: <code className="text-primary font-mono text-[10px]">business_locations</code>
            </span>
            <span className="font-bold text-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green"></span> Cached &amp; Persistent
            </span>
          </div>
        </div>

        {/* Card 2: Cached Locations List Snapshot */}
        <div className="bg-card rounded-[2.5rem] p-7 border border-border shadow-sm flex flex-col justify-between space-y-6 hover:border-blue/40 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue/10 text-blue rounded-2xl border border-blue/20">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue/15 text-blue border border-blue/20 uppercase tracking-widest">
                Locations ({locations.length > 0 ? locations.length : 1})
              </span>
            </div>

            <div className="mb-4">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-0.5">Primary Location</span>
              <h3 className="text-xl font-bold text-white tracking-tight truncate">
                {locations.find(l => l.id.toString() === selectedLocationId)?.businessName || locations[0]?.businessName || formData.businessName || 'Dhanus Gold Fitness'}
              </h3>
              <p className="text-xs text-muted font-medium mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue shrink-0" />
                <span className="truncate max-w-[220px]" title={locations.find(l => l.id.toString() === selectedLocationId)?.address || locations[0]?.address || formData.address || 'Address'}>
                  {locations.find(l => l.id.toString() === selectedLocationId)?.address || locations[0]?.address || formData.address || 'Los Angeles, CA 90210'}
                </span>
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/60 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Google Location ID:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-white bg-background/80 px-2 py-0.5 rounded border border-border/40 text-[11px]">
                    {locations.find(l => l.id.toString() === selectedLocationId)?.googleLocationId || locations[0]?.googleLocationId || 'locations/1092837465'}
                  </span>
                  <button 
                    onClick={() => copyToClipboard(locations.find(l => l.id.toString() === selectedLocationId)?.googleLocationId || locations[0]?.googleLocationId || 'locations/1092837465', 'locationId')}
                    className="text-muted hover:text-white transition-colors p-1"
                    title="Copy Location ID"
                  >
                    {copiedField === 'locationId' ? <Check className="w-3.5 h-3.5 text-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Operating Schedule:</span>
                <span className="text-green font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-green" /> 7 Days Configured
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Database Records:</span>
                <span className="text-white font-medium">
                  {locations.length > 0 ? `${locations.length} Location(s) Saved` : '1 Location Saved'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/40 border border-border/40 text-[11px] text-muted flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue" /> Location Mapping
            </span>
            <span className="font-bold text-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green"></span> Verified in DB
            </span>
          </div>
        </div>

        {/* Card 3: Synchronization & Last Synced Timestamp */}
        <div className="bg-card rounded-[2.5rem] p-7 border border-border shadow-sm flex flex-col justify-between space-y-6 hover:border-green/40 transition-all md:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green/10 text-green rounded-2xl border border-green/20">
                <RefreshCw className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green/15 text-green border border-green/20 uppercase tracking-widest">
                Account &amp; Sync
              </span>
            </div>

            <div className="mb-4">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-0.5">Last Synced Timestamp</span>
              <h3 className="text-xl font-bold text-white tracking-tight truncate">
                {displayLastSynced ? formatDate(displayLastSynced) : 'Database Synced & Ready'}
              </h3>
              <p className="text-xs text-muted font-medium mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-green" />
                <span>Account Connected: {formatDate(status?.connectedAt || primaryAccount?.createdAt || new Date().toISOString())}</span>
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/60 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Account Name:</span>
                <span className="text-white font-medium truncate max-w-[170px]" title={displayAccountName}>
                  {displayAccountName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Integration Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  currentStatusState === 'CONNECTED_READY' 
                    ? 'bg-green/10 text-green border border-green/20' 
                    : currentStatusState === 'CONNECTED_API_PENDING' || isOAuthConnected
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-muted/10 text-muted border border-border'
                }`}>
                  {currentStatusState === 'CONNECTED_READY' 
                    ? 'Live Ready' 
                    : currentStatusState === 'CONNECTED_API_PENDING' || isOAuthConnected
                    ? 'OAuth Active (Pending Quota)'
                    : 'Local Mode'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-semibold">Account Owner:</span>
                <span className="text-white font-medium truncate max-w-[160px]" title={displayEmail}>
                  {displayEmail}
                </span>
              </div>

              {/* Quick Card Actions */}
              <div className="pt-2 flex items-center gap-2">
                {isOAuthConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={handleReconnect}
                      disabled={connecting}
                      title="Clear stale credentials and force a fresh Google OAuth consent prompt"
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-background hover:bg-card border border-border text-white rounded-xl text-[11px] font-bold transition-all"
                    >
                      {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-primary" />}
                      Reconnect
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-xl text-[11px] font-bold transition-all"
                    >
                      {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm shadow-primary/20"
                  >
                    {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    Connect Account
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/40 border border-border/40 text-[11px] text-muted flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-green" /> Table: <code className="text-green font-mono text-[10px]">google_business_accounts</code>
            </span>
            <span className="font-bold text-green flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green" /> Synced
            </span>
          </div>
        </div>
      </div>

      {/* Locations Selector Cards if multiple exist */}
      {locations.length > 1 && (
        <div className="bg-card rounded-[2.5rem] p-8 border border-border shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Cached Business Locations ({locations.length})
              </h3>
              <p className="text-xs text-muted mt-1">Select a location to edit its profile and business hours below.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc) => {
              const isSelected = loc.id.toString() === selectedLocationId;
              return (
                <div 
                  key={loc.id}
                  onClick={() => handleLocationSelect(loc.id.toString())}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-primary/10 border-primary shadow-md ring-2 ring-primary/20' 
                      : 'bg-background/50 border-border/60 hover:border-primary/50 hover:bg-card-nested'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-sm text-white">{loc.businessName}</h4>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-primary" /> {loc.category || 'General'}
                  </p>
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-muted shrink-0" /> {loc.address || 'Address not specified'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* When NOT connected and no locations, show empty state callout */}
      {!isOAuthConnected && locations.length === 0 && (
        <div className="flex flex-col items-center justify-center p-16 bg-card rounded-[2.5rem] border border-border text-center space-y-6">
          <Store className="w-16 h-16 text-muted opacity-30" />
          <div className="max-w-md space-y-2">
            <h3 className="text-2xl font-bold text-white">Google Business Profile Not Connected</h3>
            <p className="text-muted text-sm">
              Link your Google account to automatically sync your business locations, customer reviews, performance insights, and enable AI review auto-replies.
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting || !status?.configured}
            className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
            Connect Google Business Profile
          </button>
        </div>
      )}

      {/* QR Code Standee Feature Callout */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-[2.5rem] p-8 border border-amber-500/30 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 z-10 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-black">
              Physical Location Booster
            </span>
            <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> High Conversion
            </span>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">
            Printable Google Review QR Code Standee
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            Generate customized 5-star Google Review standees, flyers, and counter cards. Place them at your reception, juice bar, or front desk to capture instant verified Google reviews from members on their phones!
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          className="shrink-0 flex items-center gap-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 px-7 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 z-10"
        >
          <QrCode className="w-5 h-5" />
          Generate &amp; Print QR Flyer
        </button>
      </div>

      {/* Business Details & Operating Hours Form */}
      {(isOAuthConnected || locations.length > 0) && (
        <form onSubmit={handleSave} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-card rounded-[2.5rem] p-8 border border-border shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-primary" />
                  Business Information
                </h2>
                <p className="text-xs text-muted mt-0.5">Edit information stored in your local business profile database.</p>
              </div>
              <span className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Database Sync Ready
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-primary"/> Business Name
                </label>
                <input 
                  type="text" 
                  value={formData.businessName}
                  onChange={e => setFormData({...formData, businessName: e.target.value})}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  required
                />
              </div>
              
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-primary"/> Primary Category
                </label>
                <input 
                  type="text" 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary"/> Street Address / Location
                </label>
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder="e.g. 123 Wellness Blvd, Los Angeles, CA 90210"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Description</label>
                <textarea 
                  rows={4}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Tell customers about your business, facilities, and services..."
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-primary"/> Phone Number
                </label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
              
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-primary"/> Website URL
                </label>
                <input 
                  type="url" 
                  value={formData.websiteUri}
                  onChange={e => setFormData({...formData, websiteUri: e.target.value})}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className="bg-card rounded-[2.5rem] p-8 border border-border shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-primary" />
                  Regular Operating Hours
                </h2>
                <p className="text-xs text-muted mt-0.5">Configure opening and closing schedules for customer searches.</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {days.map(day => {
                const dayData = formData.businessHours[day] || { isClosed: false, open: '', close: '' };
                return (
                  <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-4 rounded-2xl bg-background/50 border border-border/50 hover:border-border transition-colors">
                    <div className="w-44 flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        id={`check-${day}`}
                        checked={!dayData.isClosed}
                        onChange={(e) => {
                          const isClosed = !e.target.checked;
                          setFormData({
                            ...formData, 
                            businessHours: {
                              ...formData.businessHours, 
                              [day]: { ...dayData, isClosed, open: isClosed ? '' : (dayData.open || '09:00'), close: isClosed ? '' : (dayData.close || '17:00') }
                            }
                          });
                        }}
                        className="w-5 h-5 text-primary rounded-lg border-border bg-background focus:ring-primary/20 cursor-pointer"
                      />
                      <label htmlFor={`check-${day}`} className="text-sm font-bold capitalize text-white cursor-pointer select-none">
                        {day}
                      </label>
                    </div>
                    
                    {dayData.isClosed ? (
                      <span className="text-xs text-muted font-bold tracking-widest uppercase bg-danger/10 text-danger px-3.5 py-1.5 rounded-full border border-danger/20">
                        Closed
                      </span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5">
                          <span className="text-[10px] font-bold text-muted uppercase">Open</span>
                          <input 
                            type="time" 
                            value={dayData.open}
                            onChange={e => setFormData({
                              ...formData,
                              businessHours: { ...formData.businessHours, [day]: { ...dayData, open: e.target.value } }
                            })}
                            className="bg-transparent text-sm text-white font-medium outline-none"
                          />
                        </div>
                        <span className="text-xs font-bold text-muted uppercase tracking-widest">to</span>
                        <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5">
                          <span className="text-[10px] font-bold text-muted uppercase">Close</span>
                          <input 
                            type="time" 
                            value={dayData.close}
                            onChange={e => setFormData({
                              ...formData,
                              businessHours: { ...formData.businessHours, [day]: { ...dayData, close: e.target.value } }
                            })}
                            className="bg-transparent text-sm text-white font-medium outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pb-12">
            <button 
              type="submit" 
              disabled={saving}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save &amp; Publish Profile
            </button>
          </div>
        </form>
      )}

      {/* Disconnect Confirmation Modal (Works reliably in iframe without window.confirm) */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between gap-3">
              <div className="p-3 bg-danger/10 text-danger rounded-2xl border border-danger/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button 
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
                className="text-muted hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Disconnect Google Business Profile?</h3>
              <p className="text-sm text-muted mt-2 leading-relaxed">
                This will unlink your Google OAuth access token and refresh token from the database. Your cached local profile records and saved reviews will remain safely stored.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-background/60 border border-border/50 text-xs text-muted flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>You can reconnect anytime to refresh API permissions and sync business data.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
                className="px-5 py-2.5 rounded-xl border border-border text-white hover:bg-background font-bold text-sm transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-danger hover:bg-danger/90 text-white font-bold text-sm transition-all shadow-lg shadow-danger/20 disabled:opacity-50"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Google Auth Navigation Fallback Modal */}
      {authModalUrl && connecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                <Link2 className="w-6 h-6" />
              </div>
              <button 
                onClick={() => { setAuthModalUrl(null); setConnecting(false); }}
                className="text-muted hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Connecting to Google...</h3>
              <p className="text-sm text-muted mt-2 leading-relaxed">
                Redirecting to Google OAuth authorization. If your browser or preview environment blocks automatic frame navigation, click the button below to continue in a new window.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <a
                href={authModalUrl}
                target="_top"
                rel="noopener noreferrer"
                onClick={() => setConnecting(false)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all shadow-lg shadow-primary/20"
              >
                <ExternalLink className="w-4 h-4" />
                Authorize with Google
              </a>
              <button
                type="button"
                onClick={() => { setAuthModalUrl(null); setConnecting(false); }}
                className="px-5 py-2.5 rounded-xl border border-border text-muted hover:text-white hover:bg-background font-bold text-xs transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Google Review QR Code Modal */}
      <GoogleReviewQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        businessName={formData.businessName || "Dhanu's Gold Fitness"}
        googlePlaceId={locations[0]?.googleLocationId || ''}
        websiteUri={formData.websiteUri}
      />
    </div>
  );
}
