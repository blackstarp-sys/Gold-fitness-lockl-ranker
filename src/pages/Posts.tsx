import React, { useEffect, useState } from 'react';
import { Calendar, Image as ImageIcon, Clock, AlertCircle, CheckCircle2, Sparkles, Loader2, Facebook, Instagram, Linkedin, Twitter, Plus, History } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { IntegrationAlertBanner } from '../components/ConfigurationRequired.tsx';

export default function Posts() {
  const [locations, setLocations] = useState<any[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['google']);
  const [summary, setSummary] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [topicPrompt, setTopicPrompt] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ code?: string; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const locData = await apiFetch('/api/locations');
      if (locData) {
        setLocations(locData);
        if (locData.length > 0) setSelectedLocation(locData[0].id.toString());
      }

      const accData = await apiFetch('/api/social-accounts');
      if (accData) setSocialAccounts(accData);

      const postData = await apiFetch('/api/posts');
      if (postData) setPosts(postData);
    } catch (e: any) {
      setErrorInfo({
        code: e.code,
        message: e.message || 'Action failed'
      });
    }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  async function generateAICaption() {
    if (!topicPrompt) return;
    setIsGenerating(true);
    setErrorInfo(null);
    try {
      const data = await apiFetch('/api/posts/generate-caption', {
        method: 'POST',
        body: JSON.stringify({ topic: topicPrompt }),
      });
      if (data && data.caption) {
        setSummary(data.caption);
      }
    } catch (e: any) {
      setErrorInfo({
        code: e.code || 'GEMINI_CONFIGURATION_REQUIRED',
        message: e.message || 'Configure Gemini API access to use AI generation features.'
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!summary || !scheduledFor || !selectedLocation) return;
    
    setIsScheduling(true);
    setErrorInfo(null);
    try {
      const data = await apiFetch('/api/posts/schedule', {
        method: 'POST',
        body: JSON.stringify({
          locationId: selectedLocation,
          summary,
          mediaUrl,
          scheduledFor,
          platforms: selectedPlatforms
        }),
      });
      
      if (data) {
        setSummary('');
        setMediaUrl('');
        setScheduledFor('');
        setTopicPrompt('');
        fetchData();
      }
    } catch (e: any) {
      setErrorInfo({
        code: e.code,
        message: e.message || "Failed to schedule post."
      });
    } finally {
      setIsScheduling(false);
    }
  }

  const platformIcons: Record<string, React.ReactNode> = {
    google: <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />,
    facebook: <Facebook className="w-4 h-4 text-primary" />,
    instagram: <Instagram className="w-4 h-4 text-accent" />,
    linkedin: <Linkedin className="w-4 h-4 text-primary" />,
    x: <Twitter className="w-4 h-4 text-white" />,
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Channel Posts</h1>
          <p className="text-muted text-sm mt-1">Create and schedule updates across all your connected social platforms.</p>
        </div>
      </div>

      {errorInfo && (
        <IntegrationAlertBanner
          code={errorInfo.code}
          message={errorInfo.message}
          onDismiss={() => setErrorInfo(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* LEFT: Create Post Form */}
        <div className="lg:col-span-3 space-y-8">

          <form onSubmit={handleSchedule} className="bg-card p-10 rounded-[2.5rem] border border-border shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-3">Base Location</label>
                <select 
                  value={selectedLocation} 
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.businessName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-3">Publish To</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => togglePlatform('google')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${selectedPlatforms.includes('google') ? 'bg-primary/10 border-primary/40 text-primary shadow-lg shadow-primary/5' : 'bg-background border-border text-muted hover:text-white'}`}
                  >
                    {platformIcons.google} Google
                  </button>
                  {socialAccounts.map(account => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => togglePlatform(account.platformName)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${selectedPlatforms.includes(account.platformName) ? 'bg-primary/10 border-primary/40 text-primary shadow-lg shadow-primary/5' : 'bg-background border-border text-muted hover:text-white'}`}
                    >
                      {platformIcons[account.platformName]} {account.profileName}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 bg-primary/5 rounded-3xl border border-primary/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-16 h-16 text-primary" />
              </div>
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI Content Generator
              </label>
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  placeholder="e.g., Weekend sale on coffee, 20% off"
                  value={topicPrompt}
                  onChange={(e) => setTopicPrompt(e.target.value)}
                  className="flex-1 p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button 
                  type="button" 
                  onClick={generateAICaption}
                  disabled={isGenerating}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center justify-center min-w-[140px]"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-3">Post Caption</label>
              <textarea 
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                className="w-full p-4 bg-background border border-border rounded-[1.5rem] text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all leading-relaxed"
                placeholder="Write your update here..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Media URL
                </label>
                <input 
                  type="url" 
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Schedule Date
                </label>
                <input 
                  type="datetime-local" 
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all color-scheme-dark"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isScheduling}
              className="w-full bg-primary hover:bg-primary/90 text-white p-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20"
            >
              {isScheduling ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
              Schedule New Post
            </button>
          </form>
        </div>

        {/* RIGHT: Post History */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <History className="w-5 h-5 text-muted" />
            <h2 className="text-xl font-bold text-white tracking-tight">Recent Schedule</h2>
          </div>
          
          <div className="space-y-6 max-h-[1000px] overflow-y-auto pr-4 scrollbar-hide">
            {posts.map(post => (
              <div key={post.id} className="bg-card p-6 rounded-3xl border border-border group hover:border-primary/30 transition-all shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded-lg w-fit">
                      {post.businessName}
                    </span>
                    <div className="flex gap-2">
                      {(post.platforms || ['google']).map((p: string) => (
                        <span key={p} className="p-2 bg-background border border-border rounded-xl" title={p}>
                          {platformIcons[p] || p}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {post.status === 'PENDING' && <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange bg-orange/10 border border-orange/20 px-3 py-1.5 rounded-full"><Clock className="w-3.5 h-3.5"/> Pending</span>}
                  {post.status === 'PUBLISHED' && <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green bg-green/10 border border-green/20 px-3 py-1.5 rounded-full"><CheckCircle2 className="w-3.5 h-3.5"/> Published</span>}
                  {post.status === 'FAILED' && <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-danger bg-danger/10 border border-danger/20 px-3 py-1.5 rounded-full"><AlertCircle className="w-3.5 h-3.5"/> Failed</span>}
                </div>
                <p className="text-sm text-white/80 mb-5 whitespace-pre-wrap leading-relaxed line-clamp-4">{post.content}</p>
                <div className="text-[10px] text-muted font-bold uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {new Date(post.scheduledFor).toLocaleString()}
                </div>
                {post.errorMessage && (
                  <div className="mt-4 text-[10px] font-bold text-danger bg-danger/5 p-3 rounded-xl border border-danger/10">
                    ERROR: {post.errorMessage}
                  </div>
                )}
              </div>
            ))}

            {posts.length === 0 && (
              <div className="text-center p-16 text-muted bg-card rounded-[2.5rem] border border-border border-dashed">
                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-bold">No posts scheduled yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
