import React, { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, Loader2, AlertCircle, Shield, Globe, Bell, CreditCard, 
  Key, CheckCircle2, XCircle, Save, RotateCcw, Building2, User as UserIcon, 
  MapPin, Phone, Mail, Clock, DollarSign, Languages, Info, ShieldCheck, 
  ExternalLink, LogOut, Check, Sparkles, Database, MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

interface GeneralSettingsState {
  businessName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  timezone: string;
  currency: string;
  language: string;
  description: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  avatarUrl: string;
}

interface NotificationSettingsState {
  emailReviews: boolean;
  negativeReviewAlerts: boolean;
  weeklyDigest: boolean;
  aiSuggestions: boolean;
  whatsappAlerts: boolean;
  systemUpdates: boolean;
}

const DEFAULT_SETTINGS: GeneralSettingsState = {
  businessName: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  language: 'en',
  description: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  avatarUrl: '',
};

const DEFAULT_NOTIFICATIONS: NotificationSettingsState = {
  emailReviews: true,
  negativeReviewAlerts: true,
  weeklyDigest: true,
  aiSuggestions: true,
  whatsappAlerts: false,
  systemUpdates: true,
};

export default function Settings() {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Active Tab - read from query params if specified
  const requestedTab = searchParams.get('tab');
  const initialTab = (requestedTab === 'integrations' || requestedTab === 'notifications' || requestedTab === 'security' || requestedTab === 'billing') 
    ? requestedTab 
    : 'profile';

  const [activeTab, setActiveTab] = useState<'profile' | 'integrations' | 'notifications' | 'security' | 'billing'>(initialTab);

  // Sync tab with URL query parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'integrations', 'notifications', 'security', 'billing'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  // Handle hash scrolling (e.g. #google, #gemini, #ranking, #whatsapp)
  useEffect(() => {
    if (location.hash && activeTab === 'integrations') {
      const targetId = location.hash.replace('#', '');
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [location.hash, activeTab]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Notifications & Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form States
  const [formState, setFormState] = useState<GeneralSettingsState>(DEFAULT_SETTINGS);
  const [initialState, setInitialState] = useState<GeneralSettingsState>(DEFAULT_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);

  // Other Tabs Data
  const [integrations, setIntegrations] = useState<any>(null);
  const [notificationState, setNotificationState] = useState<NotificationSettingsState>(DEFAULT_NOTIFICATIONS);
  const [securityData, setSecurityData] = useState<any>(null);
  const [billingData, setBillingData] = useState<any>(null);

  // Initial Load
  useEffect(() => {
    loadAllSettings();
  }, []);

  async function loadAllSettings() {
    setLoading(true);
    setError(null);
    try {
      // 1. Load General Settings
      const settingsRes = await apiFetch('/api/settings');
      if (settingsRes && settingsRes.settings) {
        const loaded: GeneralSettingsState = {
          businessName: settingsRes.settings.businessName || '',
          email: settingsRes.settings.email || '',
          phone: settingsRes.settings.phone || '',
          website: settingsRes.settings.website || '',
          address: settingsRes.settings.address || '',
          city: settingsRes.settings.city || '',
          state: settingsRes.settings.state || '',
          postalCode: settingsRes.settings.postalCode || '',
          country: settingsRes.settings.country || 'India',
          timezone: settingsRes.settings.timezone || 'Asia/Kolkata',
          currency: settingsRes.settings.currency || 'INR',
          language: settingsRes.settings.language || 'en',
          description: settingsRes.settings.description || '',
          ownerName: settingsRes.settings.ownerName || '',
          ownerEmail: settingsRes.settings.ownerEmail || user?.email || '',
          ownerPhone: settingsRes.settings.ownerPhone || '',
          avatarUrl: settingsRes.settings.avatarUrl || '',
        };
        setFormState(loaded);
        setInitialState(loaded);
        setIsDirty(false);
      }

      // 2. Load Integrations
      try {
        const intRes = await apiFetch('/api/settings/integrations');
        setIntegrations(intRes);
      } catch (intErr) {
        console.warn('Could not load integrations', intErr);
      }

      // 3. Load Notifications
      try {
        const notifRes = await apiFetch('/api/settings/notifications');
        if (notifRes && notifRes.notifications) {
          setNotificationState(notifRes.notifications);
        }
      } catch (notifErr) {
        console.warn('Could not load notification preferences', notifErr);
      }

      // 4. Load Security
      try {
        const secRes = await apiFetch('/api/settings/security');
        if (secRes && secRes.security) {
          setSecurityData(secRes.security);
        }
      } catch (secErr) {
        console.warn('Could not load security info', secErr);
      }

      // 5. Load Billing
      try {
        const billRes = await apiFetch('/api/billing/subscription');
        setBillingData(billRes);
      } catch (billErr) {
        console.warn('Could not load billing info', billErr);
      }

    } catch (err: any) {
      console.error('[LOAD SETTINGS ERROR]', err);
      setError(err.message || 'Failed to load settings from server');
    } finally {
      setLoading(false);
    }
  }

  // Handle Input Changes
  function handleChange(field: keyof GeneralSettingsState, value: string) {
    setFormState(prev => {
      const updated = { ...prev, [field]: value };
      // Check dirty status
      const hasChanged = JSON.stringify(updated) !== JSON.stringify(initialState);
      setIsDirty(hasChanged);
      return updated;
    });

    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  }

  // Reset to initial state
  function handleReset() {
    setFormState(initialState);
    setFieldErrors({});
    setIsDirty(false);
    setError(null);
    setSuccess('Settings reverted to last saved state');
    setTimeout(() => setSuccess(null), 3000);
  }

  // Save General Settings
  async function handleSaveGeneralSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    // Client validation
    const errors: Record<string, string> = {};
    if (formState.email && formState.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formState.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }
    if (formState.website && formState.website.trim() !== '') {
      try {
        const urlToTest = formState.website.startsWith('http://') || formState.website.startsWith('https://') 
          ? formState.website 
          : `https://${formState.website}`;
        new URL(urlToTest);
      } catch {
        errors.website = 'Please enter a valid website URL (e.g. https://example.com)';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please resolve the highlighted validation errors.');
      setSaving(false);
      return;
    }

    try {
      const result = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });

      if (result && result.success) {
        const savedSettings: GeneralSettingsState = {
          ...formState,
          ...result.settings,
        };
        setFormState(savedSettings);
        setInitialState(savedSettings);
        setIsDirty(false);
        setSuccess('General Settings saved and persisted successfully!');
        setTimeout(() => setSuccess(null), 4000);
      } else {
        throw new Error(result?.message || 'Failed to save settings');
      }
    } catch (err: any) {
      console.error('[SAVE SETTINGS ERROR]', err);
      if (err.errors) {
        setFieldErrors(err.errors);
      }
      setError(err.message || 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Save Notification Preferences
  async function handleSaveNotifications() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await apiFetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationState),
      });
      if (result && result.success) {
        setSuccess('Notification preferences saved successfully!');
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  }

  // Send Password Reset
  async function handleSendPasswordReset() {
    if (!user?.email) {
      setError('No user email found to send reset link.');
      return;
    }
    setResettingPassword(true);
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSuccess(`Password reset email sent to ${user.email}. Check your inbox.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setResettingPassword(false);
    }
  }

  // Handle Logout
  async function handleLogout() {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err: any) {
      setError('Failed to log out: ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted uppercase tracking-widest">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-muted text-sm mt-1">Manage your business profile, integrations, regional preferences, and security.</p>
        </div>
        {activeTab === 'profile' && isDirty && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-white hover:bg-card-nested border border-border transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              type="button"
              onClick={handleSaveGeneralSettings}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {success && (
        <div className="bg-green/10 border border-green/20 rounded-2xl p-4 flex items-center gap-3 text-green text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4 flex items-center gap-3 text-danger text-sm font-semibold animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
          {[
            { id: 'profile', name: 'General Profile', icon: Building2, desc: 'Business & Localization' },
            { id: 'integrations', name: 'Integrations', icon: Globe, desc: 'Google, AI, APIs' },
            { id: 'notifications', name: 'Notifications', icon: Bell, desc: 'Email & WhatsApp alerts' },
            { id: 'security', name: 'Security', icon: Shield, desc: 'Authentication & Session' },
            { id: 'billing', name: 'Billing & Plan', icon: CreditCard, desc: 'Subscription & Credits' },
          ].map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id as any);
                  setError(null);
                  setSuccess(null);
                }}
                className={`w-full text-left flex items-start gap-3.5 px-5 py-3.5 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold'
                    : 'text-muted hover:bg-card-nested hover:text-white font-medium'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 mt-0.5 ${isActive ? 'text-white' : 'text-primary'}`} />
                <div>
                  <div className="text-sm">{item.name}</div>
                  <div className={`text-[11px] ${isActive ? 'text-white/80' : 'text-muted'}`}>{item.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="md:col-span-3 space-y-8">
          {/* TAB 1: GENERAL PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveGeneralSettings} className="space-y-8">
              {/* Card 1: Business Profile */}
              <div className="bg-card rounded-[2.5rem] p-8 md:p-10 border border-border space-y-6">
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Business Profile</h2>
                      <p className="text-xs text-muted">Primary information used for local ranking, reviews, and client messaging.</p>
                    </div>
                  </div>
                  {isDirty && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30">
                      Unsaved Changes
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Business Name */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                      Business Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={formState.businessName}
                      onChange={(e) => handleChange('businessName', e.target.value)}
                      placeholder="e.g. Dhanus Gold Fitness"
                      required
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-muted/40"
                    />
                    {fieldErrors.businessName && (
                      <p className="text-xs text-danger">{fieldErrors.businessName}</p>
                    )}
                  </div>

                  {/* Business Email */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Business Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted absolute left-4 top-3.5" />
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="contact@business.com"
                        className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-muted/40"
                      />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-xs text-danger">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Business Phone */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Business Phone</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-muted absolute left-4 top-3.5" />
                      <input
                        type="text"
                        value={formState.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-muted/40"
                      />
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-xs text-danger">{fieldErrors.phone}</p>
                    )}
                  </div>

                  {/* Website */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Website URL</label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-muted absolute left-4 top-3.5" />
                      <input
                        type="url"
                        value={formState.website}
                        onChange={(e) => handleChange('website', e.target.value)}
                        placeholder="https://www.example.com"
                        className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-muted/40"
                      />
                    </div>
                    {fieldErrors.website && (
                      <p className="text-xs text-danger">{fieldErrors.website}</p>
                    )}
                  </div>

                  {/* Business Address */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Street Address</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-muted absolute left-4 top-3.5" />
                      <input
                        type="text"
                        value={formState.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                        placeholder="123 Fitness Boulevard, Sector 4"
                        className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-muted/40"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">City</label>
                    <input
                      type="text"
                      value={formState.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder="Mumbai / New Delhi"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    />
                  </div>

                  {/* State */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">State / Province</label>
                    <input
                      type="text"
                      value={formState.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      placeholder="Maharashtra"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    />
                  </div>

                  {/* Postal Code */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Postal / ZIP Code</label>
                    <input
                      type="text"
                      value={formState.postalCode}
                      onChange={(e) => handleChange('postalCode', e.target.value)}
                      placeholder="400001"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    />
                  </div>

                  {/* Country */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Country</label>
                    <input
                      type="text"
                      value={formState.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      placeholder="India"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-muted uppercase tracking-wider">Business Description</label>
                      <span className="text-[10px] text-muted">{formState.description.length}/2000</span>
                    </div>
                    <textarea
                      rows={3}
                      value={formState.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Describe your business services, specialties, and value propositions for AI review and post optimization..."
                      maxLength={2000}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-muted/40 leading-relaxed resize-none"
                    />
                    {fieldErrors.description && (
                      <p className="text-xs text-danger">{fieldErrors.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Localization & Regional Settings */}
              <div className="bg-card rounded-[2.5rem] p-8 md:p-10 border border-border space-y-6">
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent border border-accent/20">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Regional &amp; Localization</h2>
                    <p className="text-xs text-muted">Controls reporting timezones, analytics dates, and currency symbols.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Timezone */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" /> Timezone
                    </label>
                    <select
                      value={formState.timezone}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST +9:00)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                    </select>
                  </div>

                  {/* Currency */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-green" /> Currency
                    </label>
                    <select
                      value={formState.currency}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    >
                      <option value="INR">INR (₹ Indian Rupee)</option>
                      <option value="USD">USD ($ US Dollar)</option>
                      <option value="EUR">EUR (€ Euro)</option>
                      <option value="GBP">GBP (£ British Pound)</option>
                      <option value="AED">AED (د.إ UAE Dirham)</option>
                      <option value="CAD">CAD ($ Canadian Dollar)</option>
                      <option value="AUD">AUD ($ Australian Dollar)</option>
                      <option value="SGD">SGD ($ Singapore Dollar)</option>
                    </select>
                  </div>

                  {/* Language */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-accent" /> Default Language
                    </label>
                    <select
                      value={formState.language}
                      onChange={(e) => handleChange('language', e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    >
                      <option value="en">English (en)</option>
                      <option value="hi">Hindi (hi)</option>
                      <option value="es">Spanish (es)</option>
                      <option value="fr">French (fr)</option>
                      <option value="de">German (de)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 3: Owner & Account Profile */}
              <div className="bg-card rounded-[2.5rem] p-8 md:p-10 border border-border space-y-6">
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 border border-purple-500/20">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Owner Profile</h2>
                    <p className="text-xs text-muted">Personal account and representative contact details.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Display Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Display Name</label>
                    <input
                      type="text"
                      value={formState.ownerName}
                      onChange={(e) => handleChange('ownerName', e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    />
                    {fieldErrors.ownerName && (
                      <p className="text-xs text-danger">{fieldErrors.ownerName}</p>
                    )}
                  </div>

                  {/* Owner Phone */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Owner Direct Phone</label>
                    <input
                      type="text"
                      value={formState.ownerPhone}
                      onChange={(e) => handleChange('ownerPhone', e.target.value)}
                      placeholder="+91 98765 00000"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    />
                  </div>

                  {/* Auth Email (Read-only indication) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider flex items-center justify-between">
                      <span>Account Auth Email</span>
                      <span className="text-[10px] text-green flex items-center gap-1 font-semibold">
                        <ShieldCheck className="w-3 h-3" /> Firebase Auth
                      </span>
                    </label>
                    <input
                      type="text"
                      value={user?.email || formState.ownerEmail}
                      disabled
                      className="w-full bg-background/50 border border-border/70 rounded-xl px-4 py-3 text-sm text-muted font-medium cursor-not-allowed"
                    />
                    <p className="text-[11px] text-muted">Primary account email used to authenticate into Local Ranker.</p>
                  </div>

                  {/* Avatar URL */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Profile Photo URL</label>
                    <input
                      type="url"
                      value={formState.avatarUrl}
                      onChange={(e) => handleChange('avatarUrl', e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!isDirty || saving}
                  className="px-6 py-3 rounded-2xl text-sm font-bold text-muted hover:text-white hover:bg-card-nested border border-border transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Revert Changes
                </button>
                <button
                  type="submit"
                  disabled={!isDirty || saving}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="space-y-8">
              <div className="bg-card rounded-[2.5rem] p-8 md:p-10 border border-border space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-white">Connected Integrations</h2>
                  <p className="text-xs text-muted mt-1">Live status of Google APIs, Gemini LLM, Rank Tracking, and Relational Database.</p>
                </div>

                <div className="space-y-4">
                  {/* Google Business Profile */}
                  <div id="google" className="p-6 bg-card-nested border border-border rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 scroll-mt-24">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 bg-background border border-border rounded-2xl flex items-center justify-center shrink-0">
                        <Globe className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-white">Google Business Profile API</p>
                          {integrations?.google?.connected ? (
                            integrations?.google?.quotaNotGranted ? (
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                                OAUTH CONNECTED (QUOTA PENDING)
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-green bg-green/10 px-2.5 py-0.5 rounded-full border border-green/20">
                                ACTIVE
                              </span>
                            )
                          ) : integrations?.google?.configured ? (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                              READY TO CONNECT
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-muted bg-background px-2.5 py-0.5 rounded-full border border-border">
                              CONFIGURATION REQUIRED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {integrations?.google?.connected 
                            ? `Connected with ${integrations?.google?.locationsCount || 1} location(s) cached locally in DB.`
                            : 'Sync customer reviews, schedule GBP posts, and track search performance metrics.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/google-business')}
                      className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                    >
                      Manage Profile <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Gemini AI Lab */}
                  <div id="gemini" className="p-6 bg-card-nested border border-border rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 scroll-mt-24">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 bg-background border border-border rounded-2xl flex items-center justify-center shrink-0">
                        <Sparkles className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">Google Gemini AI Studio</p>
                          {integrations?.gemini?.configured ? (
                            <span className="text-[10px] font-black text-green bg-green/10 px-2.5 py-0.5 rounded-full border border-green/20">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                              CONFIGURATION REQUIRED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1">Powers automated smart review replies, local SEO post drafting, and photo captions.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/ai-mode')}
                      className="px-4 py-2 bg-card border border-border hover:bg-card-nested text-white rounded-xl text-xs font-bold transition-all shrink-0"
                    >
                      Open AI Studio
                    </button>
                  </div>

                  {/* Local Rank Tracking Provider */}
                  <div id="ranking" className="p-6 bg-card-nested border border-border rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 scroll-mt-24">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 bg-background border border-border rounded-2xl flex items-center justify-center shrink-0">
                        <MapPin className="w-6 h-6 text-orange" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">Local Rank &amp; Keyword Engine</p>
                          <span className="text-[10px] font-black text-green bg-green/10 px-2.5 py-0.5 rounded-full border border-green/20">
                            ACTIVE
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-1">Monitors keyword 3-pack rankings, competitor changes, and Google Search visibility.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/keywords')}
                      className="px-4 py-2 bg-card border border-border hover:bg-card-nested text-white rounded-xl text-xs font-bold transition-all shrink-0"
                    >
                      View Keywords
                    </button>
                  </div>

                  {/* WhatsApp Business */}
                  <div id="whatsapp" className="p-6 bg-card-nested border border-border rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 scroll-mt-24">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 bg-background border border-border rounded-2xl flex items-center justify-center shrink-0">
                        <MessageSquare className="w-6 h-6 text-green" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">WhatsApp Business API</p>
                          {integrations?.whatsapp?.configured ? (
                            <span className="text-[10px] font-black text-green bg-green/10 px-2.5 py-0.5 rounded-full border border-green/20">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-muted bg-background px-2.5 py-0.5 rounded-full border border-border">
                              CONFIGURATION REQUIRED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1">Automated review requests sent directly to customers over WhatsApp messaging.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="px-4 py-2 bg-card border border-border hover:bg-card-nested text-white rounded-xl text-xs font-bold transition-all shrink-0"
                    >
                      Campaign Status
                    </button>
                  </div>

                  {/* PostgreSQL Database */}
                  <div className="p-6 bg-card-nested border border-border rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 bg-background border border-border rounded-2xl flex items-center justify-center shrink-0">
                        <Database className="w-6 h-6 text-blue" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">PostgreSQL &amp; Drizzle ORM</p>
                          <span className="text-[10px] font-black text-green bg-green/10 px-2.5 py-0.5 rounded-full border border-green/20">
                            CONNECTED
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-1">High-performance relational persistence with isolated multi-tenant records.</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green/10 text-green border border-green/20 rounded-xl text-xs font-bold">
                      Operational
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="bg-card rounded-[2.5rem] p-8 md:p-10 border border-border space-y-8">
              <div className="border-b border-border/50 pb-4">
                <h2 className="text-xl font-bold text-white">Notification Preferences</h2>
                <p className="text-xs text-muted mt-1">Configure how and when you receive critical review alerts and performance summaries.</p>
              </div>

              <div className="space-y-6">
                {[
                  {
                    key: 'emailReviews',
                    title: 'New Google Review Alerts',
                    desc: 'Receive an immediate email notification whenever a new review is posted.',
                  },
                  {
                    key: 'negativeReviewAlerts',
                    title: 'Urgent Negative Review Alerts (< 3 Stars)',
                    desc: 'High-priority alert to enable instant customer service triage.',
                  },
                  {
                    key: 'weeklyDigest',
                    title: 'Weekly Performance & Rank Digest',
                    desc: 'A weekly summary of local 3-pack rank shifts, review counts, and profile views.',
                  },
                  {
                    key: 'aiSuggestions',
                    title: 'AI Smart Recommendations',
                    desc: 'Suggestions for new Google Posts and review replies generated by Gemini.',
                  },
                  {
                    key: 'whatsappAlerts',
                    title: 'WhatsApp Instant Alerts',
                    desc: 'Send review notifications directly to the owner WhatsApp number.',
                  },
                  {
                    key: 'systemUpdates',
                    title: 'System & Security Alerts',
                    desc: 'Important account, OAuth renewal, and quota status announcements.',
                  },
                ].map((item) => {
                  const val = (notificationState as any)[item.key] ?? false;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-card-nested border border-border">
                      <div className="space-y-0.5 pr-4">
                        <p className="text-sm font-bold text-white">{item.title}</p>
                        <p className="text-xs text-muted">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationState(prev => ({
                            ...prev,
                            [item.key]: !val
                          }));
                        }}
                        className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                          val ? 'bg-primary' : 'bg-background border border-border'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            val ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={saving}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Notification Preferences
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              {/* Account Security Information */}
              <div className="bg-card rounded-[2.5rem] p-8 md:p-10 border border-border space-y-6">
                <div className="border-b border-border/50 pb-4">
                  <h2 className="text-xl font-bold text-white">Account Security &amp; Credentials</h2>
                  <p className="text-xs text-muted mt-1">Firebase Authentication tokens and security credentials.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-5 bg-card-nested border border-border rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Sign-In Email</span>
                    <p className="text-sm font-bold text-white truncate">{user?.email || securityData?.email}</p>
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green bg-green/10 px-2.5 py-0.5 rounded-full border border-green/20">
                        <Check className="w-3 h-3" /> Verified Account
                      </span>
                    </div>
                  </div>

                  <div className="p-5 bg-card-nested border border-border rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Firebase User UID</span>
                    <p className="text-xs font-mono text-muted truncate">{user?.uid || securityData?.uid}</p>
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                        Firebase ID Token Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Password Management */}
                <div className="p-6 bg-card-nested border border-border rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                  <div className="space-y-1">
                    <p className="font-bold text-white">Change / Reset Password</p>
                    <p className="text-xs text-muted">
                      Receive an official password reset link directly at <span className="text-white font-medium">{user?.email}</span>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendPasswordReset}
                    disabled={resettingPassword}
                    className="px-5 py-2.5 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2"
                  >
                    {resettingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                    Send Password Reset Email
                  </button>
                </div>

                {/* Active Session & Logout */}
                <div className="p-6 bg-danger/5 border border-danger/20 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
                  <div className="space-y-1">
                    <p className="font-bold text-danger">Sign Out of Session</p>
                    <p className="text-xs text-muted">Terminate the active Firebase authenticated session on this device.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-5 py-2.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BILLING & PLAN */}
          {activeTab === 'billing' && (
            <div className="bg-card rounded-[2.5rem] p-8 md:p-10 border border-border space-y-8">
              <div className="border-b border-border/50 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Subscription &amp; Usage</h2>
                  <p className="text-xs text-muted mt-1">Manage your Local Ranker plan, monthly AI credits, and renewal dates.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green/10 text-green border border-green/20">
                  {billingData?.status || 'ACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-6 bg-card-nested border border-border rounded-3xl space-y-2">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Current Plan</span>
                  <p className="text-xl font-bold text-white">{billingData?.plan || 'Professional Plan'}</p>
                  <p className="text-xs text-muted">Full local SEO suite &amp; GBP sync</p>
                </div>

                <div className="p-6 bg-card-nested border border-border rounded-3xl space-y-2">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Monthly Allowance</span>
                  <p className="text-xl font-bold text-primary">100 AI Credits</p>
                  <p className="text-xs text-muted">Renews on {billingData?.renewalDate || 'next billing cycle'}</p>
                </div>

                <div className="p-6 bg-card-nested border border-border rounded-3xl space-y-2">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Plan Price</span>
                  <p className="text-xl font-bold text-white">${billingData?.price || 49}<span className="text-xs font-normal text-muted">/month</span></p>
                  <p className="text-xs text-muted">Billed monthly</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/manage-plan')}
                  className="px-6 py-3 rounded-2xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all"
                >
                  Upgrade or Change Plan
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/usage')}
                  className="px-6 py-3 rounded-2xl text-xs font-bold bg-card-nested border border-border hover:bg-background text-white transition-all"
                >
                  View Usage Logs
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
