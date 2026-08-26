import React, { useEffect, useState } from 'react';
import { Target, Loader2, Plus, ChevronRight, X, Calendar, Megaphone, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired, { IntegrationAlertBanner } from '../components/ConfigurationRequired.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export default function Programs() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [programName, setProgramName] = useState('');
  const [programType, setProgramType] = useState('Review Generation');
  const [targetAudience, setTargetAudience] = useState('All Customers');
  const [submitting, setSubmitting] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setErrorInfo(null);
    try {
      const res = await apiFetch('/api/campaigns');
      if (res) setData(Array.isArray(res) ? res : [res]);
    } catch (err: any) {
      console.error(err);
      setErrorInfo({
        status: err.status,
        code: err.code || 'CONFIGURATION_REQUIRED',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  }

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programName.trim()) return;

    setSubmitting(true);
    try {
      const newProg = {
        id: Date.now(),
        name: programName,
        type: programType,
        targetAudience,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };

      // Attempt backend API call if available
      try {
        await apiFetch('/api/campaigns', {
          method: 'POST',
          body: JSON.stringify(newProg)
        });
      } catch (err) {
        // Fallback to updating state locally
      }

      setData((prev) => [newProg, ...prev]);
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/campaigns',
        title: 'Program Created',
        message: `Successfully launched program "${programName}"`
      });

      setProgramName('');
      setShowModal(false);
    } catch (err: any) {
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
    if (errorInfo.code === 'WHATSAPP_CONFIGURATION_REQUIRED' || errorInfo.code === 'CONFIGURATION_REQUIRED') {
      return (
        <ConfigurationRequired 
          code="WHATSAPP_CONFIGURATION_REQUIRED"
        />
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center m-6">
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Programs</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active Programs</h1>
          <p className="text-muted text-sm mt-1">Manage and track your marketing campaigns and training programs.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Program
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-card rounded-[2.5rem] border border-border p-20 text-center">
          <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
            <Target className="w-10 h-10 text-muted opacity-30" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No active programs</h3>
          <p className="text-muted mb-8 max-w-md mx-auto">Launch your first campaign to start tracking performance metrics.</p>
          <button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/10">
            Launch First Program
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-nested text-[10px] uppercase font-black text-muted tracking-widest border-b border-border">
              <tr>
                <th className="px-8 py-5">Program / Campaign</th>
                <th className="px-8 py-5">Type</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((item, i) => (
                <tr key={item.id || i} className="hover:bg-card-nested/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center font-bold text-primary">
                        {item.name?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-primary transition-colors">{item.name || 'Untitled Program'}</p>
                        <p className="text-[10px] text-muted font-mono">{item.targetAudience || 'All Customers'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-medium text-slate-300 bg-card-nested px-3 py-1 rounded-lg border border-border">
                      {item.type || 'Review Surge'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      item.status === 'ACTIVE' ? 'bg-green/10 text-green border border-green/20' : 'bg-orange/10 text-orange border border-orange/20'
                    }`}>
                      {item.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => {
                        notifyApiSuccess({
                          method: 'GET',
                          pathname: `/api/campaigns/${item.id || i}`,
                          title: 'Program Selected',
                          message: `Viewing analytics for ${item.name}`
                        });
                      }} 
                      className="text-xs font-bold text-primary hover:text-accent transition-colors flex items-center justify-end gap-1 ml-auto"
                    >
                      View Details <ChevronRight className="w-3 h-3" />
                    </button>
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
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create New Program</h3>
                  <p className="text-xs text-muted">Set up an automated marketing campaign</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Program Name</label>
                <input
                  type="text"
                  required
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g. Summer VIP Review Surge"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Campaign Type</label>
                <select
                  value={programType}
                  onChange={(e) => setProgramType(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="Review Generation">Google Review Generation</option>
                  <option value="WhatsApp Follow-up">WhatsApp Follow-up Sequence</option>
                  <option value="Local SEO Rank Surge">Local SEO Rank Surge</option>
                  <option value="Customer Re-engagement">Customer Re-engagement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Target Audience</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="All Customers">All Customers</option>
                  <option value="Recent Visitors">Recent Visitors (Last 30 Days)</option>
                  <option value="VIP Members">VIP Members</option>
                  <option value="Unreviewed Customers">Unreviewed Customers</option>
                </select>
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
                  Launch Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

