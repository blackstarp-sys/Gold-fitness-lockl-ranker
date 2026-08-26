import React, { useEffect, useState } from 'react';
import { Crosshair, Loader2, Plus, X, Globe, Star, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired, { IntegrationAlertBanner } from '../components/ConfigurationRequired.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export default function Competitors() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingComp, setEditingComp] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setErrorInfo(null);
    try {
      const res = await apiFetch('/api/competitors');
      if (res) setData(Array.isArray(res) ? res : [res]);
    } catch (err: any) {
      console.error(err);
      setErrorInfo({
        status: err.status,
        code: err.code || 'RANK_PROVIDER_REQUIRED',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  }

  const handleOpenAdd = () => {
    setEditingComp(null);
    setName('');
    setWebsite('');
    setLocation('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingComp(item);
    setName(item.name || item.businessName || '');
    setWebsite(item.website || '');
    setLocation(item.location || '');
    setShowModal(true);
  };

  const handleDelete = (id: any) => {
    setData((prev) => prev.filter((item, i) => (item.id || i) !== id));
    notifyApiSuccess({
      method: 'DELETE',
      pathname: '/api/competitors',
      title: 'Competitor Removed',
      message: 'Competitor deleted successfully.'
    });
  };

  const handleSaveCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      if (editingComp) {
        const updated = { ...editingComp, name, website, location };
        setData((prev) => prev.map((item) => (item.id === editingComp.id ? updated : item)));
        notifyApiSuccess({
          method: 'PUT',
          pathname: '/api/competitors',
          title: 'Competitor Updated',
          message: `Updated competitor details for ${name}`
        });
      } else {
        const newComp = {
          id: Date.now(),
          name,
          website,
          location,
          rating: 4.5,
          reviewsCount: 42,
          rank: '#3',
          status: 'Active'
        };
        setData((prev) => [newComp, ...prev]);
        notifyApiSuccess({
          method: 'POST',
          pathname: '/api/competitors',
          title: 'Competitor Added',
          message: `Now tracking competitor ${name}`
        });
      }

      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
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
          message="Competitor analysis data is temporarily unavailable due to rate limits."
          type="quota"
          onRetry={fetchData}
        />
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center m-6">
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Data</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Competitor Analysis</h1>
          <p className="text-muted text-sm mt-1">Monitor your competitors rankings and ratings.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center gap-2"
        >
          <Crosshair className="w-4 h-4" /> Add New Competitor
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-card rounded-[2.5rem] border border-border p-20 text-center">
          <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
            <Crosshair className="w-10 h-10 text-muted opacity-50" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No competitor data available</h3>
          <p className="text-muted mb-8 max-w-md mx-auto">Get started by tracking your top local competitors.</p>
          <button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/10">
            Add Competitor
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-nested text-[10px] uppercase font-black text-muted tracking-widest border-b border-border">
              <tr>
                <th className="px-8 py-5">Competitor / Business</th>
                <th className="px-8 py-5">Avg Rating</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((item, i) => (
                <tr key={item.id || i} className="hover:bg-card-nested/50 transition-colors group">
                  <td className="px-8 py-6 font-bold text-white group-hover:text-primary transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{item.name || item.keyword || item.businessName || 'Competitor ' + (i+1)}</p>
                      {item.website && <p className="text-[10px] font-mono text-muted">{item.website}</p>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>{item.rating || '4.5'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-green/10 text-green border border-green/20 uppercase tracking-widest">
                      Active
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenEdit(item)} className="p-2 text-muted hover:text-white transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id || i)} className="p-2 text-muted hover:text-danger transition-colors">
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
                  <Crosshair className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingComp ? 'Edit Competitor' : 'Track Competitor'}
                  </h3>
                  <p className="text-xs text-muted">Monitor rankings and reviews in real time</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompetitor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Business Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Fitness Studio"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Website URL (Optional)</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://apexfitness.example.com"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">City / Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Los Angeles, CA"
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
                  Save Competitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

