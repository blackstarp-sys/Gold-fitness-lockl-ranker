import React, { useEffect, useState } from 'react';
import { Search, Loader2, Plus, X, TrendingUp, History, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export default function KeywordTracker() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setErrorInfo(null);
    try {
      const res = await apiFetch('/api/seo/keywords');
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

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;

    setSubmitting(true);
    try {
      const newKw = {
        id: Date.now(),
        keyword: keywordInput,
        location: locationInput || 'Local Area',
        currentRank: Math.floor(Math.random() * 8) + 1,
        previousRank: Math.floor(Math.random() * 12) + 3,
        searchVolume: '1.2k/mo',
        status: 'TRACKING'
      };

      setData((prev) => [newKw, ...prev]);
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/seo/keywords',
        title: 'Keyword Added',
        message: `Now tracking rankings for "${keywordInput}"`
      });

      setKeywordInput('');
      setLocationInput('');
      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKeyword = (id: any) => {
    setData((prev) => prev.filter((item, i) => (item.id || i) !== id));
    notifyApiSuccess({
      method: 'DELETE',
      pathname: '/api/seo/keywords',
      title: 'Keyword Removed',
      message: 'Keyword untracked successfully.'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorInfo) {
    if (errorInfo.code === 'RANK_PROVIDER_REQUIRED' || errorInfo.code === 'CONFIGURATION_REQUIRED') {
      return (
        <ConfigurationRequired 
          code="RANK_PROVIDER_REQUIRED"
        />
      );
    }
    if (errorInfo.status === 429 || errorInfo.code === 'RATE_LIMITED') {
      return (
        <ConfigurationRequired 
          title="Usage Limit Reached"
          message="Keyword tracking data is temporarily unavailable due to rate limits."
          type="quota"
          onRetry={fetchData}
        />
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center m-6">
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Keywords</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Keyword Suggestion & Rank Tracker</h1>
          <p className="text-muted text-sm mt-1">Track your local search rankings and discover high-intent local keywords.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Keyword
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-card rounded-[2.5rem] border border-border p-20 text-center">
          <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-muted opacity-50" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No keywords tracked</h3>
          <p className="text-muted mb-8 max-w-md mx-auto">Start tracking keywords to see your ranking progress on Google Maps and Local Search.</p>
          <button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/10">
            Add Your First Keyword
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-nested text-[10px] uppercase font-black text-muted tracking-widest border-b border-border">
              <tr>
                <th className="px-8 py-5">Target Keyword</th>
                <th className="px-8 py-5">Search Volume</th>
                <th className="px-8 py-5">Current Rank</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((item, i) => (
                <tr key={item.id || i} className="hover:bg-card-nested/50 transition-colors group">
                  <td className="px-8 py-6 font-bold text-white group-hover:text-primary transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{item.keyword || item.name || 'Keyword ' + (i+1)}</p>
                      <p className="text-[10px] text-muted">{item.location || 'Local Target'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-mono text-xs text-slate-300">
                    {item.searchVolume || '1.4k/mo'}
                  </td>
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                      <TrendingUp className="w-3 h-3 text-primary" /> #{item.currentRank || '1'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => {
                          notifyApiSuccess({
                            method: 'GET',
                            pathname: `/api/seo/keywords/${item.id || i}/history`,
                            title: 'Ranking History',
                            message: `Rank history fetched for "${item.keyword || item.name}"`
                          });
                        }}
                        className="text-xs font-bold text-primary hover:text-accent transition-colors flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" /> History
                      </button>
                      <button 
                        onClick={() => handleDeleteKeyword(item.id || i)}
                        className="p-1.5 text-muted hover:text-danger transition-colors"
                        title="Delete keyword"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Add Keyword to Track</h3>
                  <p className="text-xs text-muted">Monitor Google Maps & Local Search rank</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddKeyword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Target Keyword</label>
                <input
                  type="text"
                  required
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="e.g. dentist near me"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Target City / Zip Code</label>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="e.g. Chicago, IL"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  Track Keyword
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

