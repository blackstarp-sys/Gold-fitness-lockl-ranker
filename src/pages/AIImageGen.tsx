import React, { useEffect, useState } from 'react';
import { ImageIcon, Loader2, Sparkles, ImagePlus, History, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';

export default function AIImageGen() {
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
      const res = await apiFetch('/api/ai/images');
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
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Image Lab</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Image Generator</h1>
          <p className="text-muted text-sm mt-1">Create professional, brand-aligned photos for your Google Profile.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-[2.5rem] p-10 border border-border space-y-8">
             <div className="p-8 bg-accent/5 rounded-3xl border border-accent/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ImageIcon className="w-16 h-16 text-accent" />
              </div>
              <label className="block text-[10px] font-black text-accent uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI Image Prompt
              </label>
              <div className="space-y-6">
                <textarea 
                  rows={4}
                  placeholder="Describe the image you want to create (e.g. Modern fitness studio with gold accents, wide angle, professional photography...)"
                  className="w-full p-4 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Aspect Ratio</label>
                    <select className="w-full p-3 bg-background border border-border rounded-xl text-xs text-white font-bold outline-none">
                      <option>Square (1:1)</option>
                      <option>Landscape (16:9)</option>
                      <option>Portrait (3:4)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Style</label>
                    <select className="w-full p-3 bg-background border border-border rounded-xl text-xs text-white font-bold outline-none">
                      <option>Photorealistic</option>
                      <option>Digital Art</option>
                      <option>Minimalist</option>
                    </select>
                  </div>
                </div>
                <button className="w-full bg-accent hover:bg-accent/90 text-white p-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-xl shadow-accent/20">
                  <ImagePlus className="w-6 h-6" /> Generate Masterpiece
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-card rounded-[2.5rem] p-8 border border-border">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-muted" />
                <h3 className="text-lg font-bold">Generated Assets</h3>
              </div>
              
              {data.length === 0 ? (
                <div className="text-center py-12 opacity-30">
                  <Search className="w-10 h-10 mx-auto mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No images yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                   {data.map((item, i) => (
                     <div key={i} className="aspect-square bg-card-nested border border-border rounded-2xl overflow-hidden group relative">
                        <img src={item.url} alt="Generated" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button className="bg-white/10 backdrop-blur-md text-white p-2 rounded-lg text-[10px] font-bold border border-white/20">Download</button>
                        </div>
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
