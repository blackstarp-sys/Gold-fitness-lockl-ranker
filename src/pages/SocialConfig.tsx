import React, { useState, useEffect } from 'react';
import { Facebook, Instagram, Linkedin, Twitter, CheckCircle2, Link as LinkIcon, Loader2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { SocialAccount } from '../types/index.ts';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export default function SocialConfig() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/social-accounts');
      if (data) setAccounts(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingPlatform || !handleInput.trim()) return;

    setSubmitting(true);
    try {
      const newAcc: SocialAccount = {
        id: Date.now(),
        platformName: connectingPlatform,
        profileId: handleInput,
        profileName: handleInput
      };

      setAccounts(prev => [...prev.filter(a => a.platformName !== connectingPlatform), newAcc]);
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/social-accounts',
        title: 'Platform Connected',
        message: `Successfully linked ${connectingPlatform} profile @${handleInput}`
      });

      setConnectingPlatform(null);
      setHandleInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  async function disconnectPlatform(id: number) {
    try {
      setAccounts(prev => prev.filter(a => a.id !== id));
      notifyApiSuccess({
        method: 'DELETE',
        pathname: `/api/social-accounts/${id}`,
        title: 'Account Disconnected',
        message: 'Social channel unlinked.'
      });
    } catch (e) {
      console.error(e);
    }
  }

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-[#1877F2]', bg: 'bg-[#1877F2]/10' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-[#E4405F]', bg: 'bg-[#E4405F]/10' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-[#0A66C2]', bg: 'bg-[#0A66C2]/10' },
    { id: 'x', name: 'X (Twitter)', icon: Twitter, color: 'text-white', bg: 'bg-white/10' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Social Configurations</h1>
        <p className="text-muted text-sm mt-1">Connect your external social media accounts to publish posts across multiple channels.</p>
      </div>

      {error && (
        <div className="bg-orange/10 border border-orange/20 rounded-2xl p-6 flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange/20 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange" />
            </div>
            <p className="text-sm font-bold text-white">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-muted hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {platforms.map(platform => {
          const connectedAccount = accounts.find(a => a.platformName === platform.id);
          const Icon = platform.icon;
          return (
            <div key={platform.id} className="bg-card rounded-[2.5rem] p-8 border border-border flex flex-col justify-between group hover:border-primary/30 transition-all duration-300">
              <div className="flex items-center gap-5 mb-8">
                <div className={`p-5 rounded-2xl ${platform.bg} border border-white/5 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-8 h-8 ${platform.color}`} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{platform.name}</h3>
                  {connectedAccount ? (
                    <p className="text-xs text-green flex items-center gap-1.5 font-bold mt-1 tracking-widest uppercase">
                      <CheckCircle2 className="w-4 h-4" /> {connectedAccount.profileName}
                    </p>
                  ) : (
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1">Disconnected</p>
                  )}
                </div>
              </div>

              {connectedAccount ? (
                <button 
                  onClick={() => disconnectPlatform(connectedAccount.id)}
                  className="w-full py-4 bg-card-nested hover:bg-danger/10 text-muted hover:text-danger rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-border"
                >
                  Disconnect Account
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setConnectingPlatform(platform.id);
                    setHandleInput('');
                  }}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-primary/10 hover:translate-y-[-2px] active:translate-y-[0px] flex items-center justify-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" /> Connect {platform.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Connection Modal */}
      {connectingPlatform && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Connect {connectingPlatform}</h3>
                  <p className="text-xs text-muted">Enter page handle or account username</p>
                </div>
              </div>
              <button onClick={() => setConnectingPlatform(null)} className="text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Profile / Page Handle</label>
                <input
                  type="text"
                  required
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="e.g. mybusiness_official"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setConnectingPlatform(null)}
                  className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-card-nested"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Connect Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

