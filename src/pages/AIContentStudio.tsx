import React, { useEffect, useState } from 'react';
import { Bot, Loader2, Sparkles, Send, History, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';

export default function AIContentStudio() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);
  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setErrorInfo(null);
    try {
      const res = await apiFetch('/api/ai/studio');
      if (res) setData(Array.isArray(res) ? res : [res]);
    } catch (err: any) {
      console.error(err);
      setErrorInfo({
        status: err.status,
        code: err.code,
        message: err.message
      });
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

  if (errorInfo) {
    if (errorInfo.code === 'GEMINI_CONFIGURATION_REQUIRED' || errorInfo.code === 'CONFIGURATION_REQUIRED') {
      return (
        <ConfigurationRequired 
          code="GEMINI_CONFIGURATION_REQUIRED"
        />
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center m-6">
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Studio</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Content Studio</h1>
          <p className="text-muted text-sm mt-1">Generate SEO-optimized content for your local business.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-[2.5rem] p-10 border border-border space-y-8">
             <div className="p-8 bg-primary/5 rounded-3xl border border-primary/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-16 h-16 text-primary" />
              </div>
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Content Generator
              </label>
              <div className="space-y-6">
                <input 
                  type="text" 
                  placeholder="What would you like to write today? (e.g. Services description, FAQ, SEO blog post...)"
                  className="w-full p-4 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <div className="flex gap-4">
                  <button className="flex-1 bg-primary hover:bg-primary/90 text-white p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10">
                    <Sparkles className="w-5 h-5" /> Generate Ideas
                  </button>
                  <button className="flex-1 bg-card hover:bg-card-nested text-white p-4 rounded-xl font-bold transition-all border border-border flex items-center justify-center gap-2">
                    <Send className="w-5 h-5" /> Write Draft
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-lg font-bold">Templates</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {['Service Descriptions', 'FAQ Generator', 'SEO Keywords', 'Marketing Plan'].map((t) => (
                   <button key={t} className="p-6 bg-card-nested border border-border rounded-2xl hover:border-primary/50 transition-all text-left group">
                     <p className="font-bold text-white group-hover:text-primary transition-colors">{t}</p>
                     <p className="text-xs text-muted mt-1">Start from this professional AI template.</p>
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-card rounded-[2.5rem] p-8 border border-border">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-muted" />
                <h3 className="text-lg font-bold">Recent History</h3>
              </div>
              
              {data.length === 0 ? (
                <div className="text-center py-12 opacity-30">
                  <Search className="w-10 h-10 mx-auto mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {data.map((item, i) => (
                     <div key={i} className="p-4 bg-card-nested border border-border rounded-2xl">
                        <p className="text-sm font-bold text-white truncate">{item.title || 'Untitled Generation'}</p>
                        <p className="text-[10px] font-bold text-muted uppercase mt-1">{new Date().toLocaleDateString()}</p>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
