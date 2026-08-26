import React, { useEffect, useState } from 'react';
import { Zap, Loader2, History, TrendingUp, Search, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export default function UsageCredits() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchUsage();
  }, []);

  async function fetchUsage() {
    setLoading(true);
    try {
      const summary = await apiFetch('/api/dashboard/summary');
      setData(summary);
    } catch (err: any) {
      console.error(err);
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usage & Credits</h1>
        <p className="text-muted text-sm mt-1">Track your AI quota and platform usage limits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-8 rounded-[2rem] border border-border">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center mb-4">
             <Zap className="w-5 h-5 text-accent" />
          </div>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">AI Credits</p>
          <h3 className="text-3xl font-black text-white">{data?.ai?.creditsRemaining || 0}</h3>
          <p className="text-xs text-muted mt-2">Available for generation</p>
        </div>
        
        <div className="bg-card p-8 rounded-[2rem] border border-border">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center mb-4">
             <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Sync Requests</p>
          <h3 className="text-3xl font-black text-white">Unlimited</h3>
          <p className="text-xs text-muted mt-2">Included in your plan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-card rounded-[2.5rem] p-10 border border-border">
              <h2 className="text-xl font-bold mb-8 flex items-center gap-2"><History className="w-5 h-5 text-muted" /> Usage History</h2>
              <div className="space-y-6">
                 {[
                   { task: 'AI Review Reply', cost: 1, date: 'Today, 2:45 PM' },
                   { task: 'Social Post Caption', cost: 2, date: 'Today, 11:20 AM' },
                   { task: 'AI Image Generation', cost: 10, date: 'Yesterday' },
                   { task: 'AI Review Reply', cost: 1, date: 'Aug 22, 2026' },
                 ].map((h, i) => (
                   <div key={i} className="flex items-center justify-between py-4 border-b border-border/50">
                      <div>
                        <p className="text-sm font-bold text-white">{h.task}</p>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{h.date}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-accent bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
                         -{h.cost} Credits
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-card rounded-[2.5rem] p-8 border border-border">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Info className="w-5 h-5 text-muted" /> How it works</h3>
              <div className="space-y-4 text-sm text-muted leading-relaxed">
                 <p>AI Credits are consumed whenever you use our Gemini-powered generation tools.</p>
                 <ul className="space-y-2 list-disc list-inside">
                   <li>Review Reply: 1 Credit</li>
                   <li>Social Post: 2 Credits</li>
                   <li>Image Generation: 10 Credits</li>
                   <li>SEO Audit: 5 Credits</li>
                 </ul>
                 <p className="pt-4">Credits reset every month based on your subscription tier.</p>
              </div>
              <button className="w-full mt-8 bg-card-nested hover:bg-background text-white p-4 rounded-2xl font-bold border border-border transition-all">Purchase More Credits</button>
           </div>
        </div>
      </div>
    </div>
  );
}
