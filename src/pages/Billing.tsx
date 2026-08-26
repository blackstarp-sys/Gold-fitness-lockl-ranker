import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export default function Billing() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function fetchSubscription() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/billing/subscription');
      setSubscription(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plans & Billing</h1>
          <p className="text-muted text-sm mt-1">Manage your subscription, invoices, and payment methods.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-card rounded-[2.5rem] p-10 border border-border space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5">
                 <ShieldCheck className="w-40 h-40" />
              </div>
              <div className="flex justify-between items-start">
                 <div>
                    <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 uppercase tracking-widest">Active Plan</span>
                    <h2 className="text-3xl font-black mt-4">{subscription?.plan || 'Professional Plan'}</h2>
                    <p className="text-muted text-sm mt-1">Renews on {subscription?.renewalDate || 'Next Month'}</p>
                 </div>
                 <h3 className="text-4xl font-black">${subscription?.price || '49'}<span className="text-lg text-muted font-bold">/mo</span></h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {[
                   'Unlimited Business Locations',
                   'AI Review Automation',
                   'Keyword Tracking (100 Keywords)',
                   'Competitor Analysis',
                   'Weekly PDF Reports',
                   'WhatsApp Notifications'
                 ].map((feat, i) => (
                   <div key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-green" /> {feat}
                   </div>
                 ))}
              </div>

              <div className="flex gap-4 pt-4">
                 <button className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/10">Manage Subscription</button>
                 <button className="bg-card-nested hover:bg-background text-white px-8 py-3 rounded-2xl font-bold transition-all border border-border">Change Plan</button>
              </div>
           </div>

           <div className="bg-card rounded-[2.5rem] p-10 border border-border space-y-8">
              <h2 className="text-xl font-bold flex items-center gap-2"><CreditCard className="w-5 h-5 text-muted" /> Payment Method</h2>
              <div className="p-8 bg-card-nested border border-border rounded-3xl flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-background border border-border rounded-xl flex items-center justify-center font-bold text-white">
                       VISA
                    </div>
                    <div>
                       <p className="font-bold text-white">•••• •••• •••• 4242</p>
                       <p className="text-xs text-muted">Expires 12/28</p>
                    </div>
                 </div>
                 <button className="text-xs font-bold text-primary hover:underline">Update</button>
              </div>
           </div>
        </div>

        <div className="space-y-8">
           <div className="bg-card rounded-[2.5rem] p-8 border border-border">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-accent" /> Usage Summary</h3>
              <div className="space-y-6">
                 {[
                   { name: 'AI Credits', used: 450, total: 1000, color: 'bg-accent' },
                   { name: 'Locations', used: 3, total: 10, color: 'bg-primary' },
                   { name: 'Keywords', used: 45, total: 100, color: 'bg-blue' }
                 ].map((u, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted">
                        <span>{u.name}</span>
                        <span>{u.used} / {u.total}</span>
                      </div>
                      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                        <div className={`h-full ${u.color}`} style={{ width: `${(u.used/u.total)*100}%` }} />
                      </div>
                   </div>
                 ))}
              </div>
              <button className="w-full mt-8 text-xs font-bold text-primary hover:underline">View Detailed Usage</button>
           </div>

           <div className="bg-card rounded-[2.5rem] p-8 border border-border">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-muted" /> Invoices</h3>
              <div className="space-y-4">
                 {[1,2].map(i => (
                   <div key={i} className="flex justify-between items-center py-2 border-b border-border/50">
                      <div>
                        <p className="text-sm font-bold text-white">Aug {i}, 2026</p>
                        <p className="text-[10px] text-muted font-bold">INV-000{i}</p>
                      </div>
                      <button className="text-xs font-bold text-primary hover:underline">PDF</button>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
