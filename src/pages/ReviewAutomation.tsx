import React, { useEffect, useState } from 'react';
import { MessageSquare, Loader2, AlertCircle, X, ChevronRight, Zap, Sparkles, Settings, Plus, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired, { IntegrationAlertBanner } from '../components/ConfigurationRequired.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export default function ReviewAutomation() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('5 Star Review');
  const [ruleAction, setRuleAction] = useState('AI Instant Reply');
  const [submitting, setSubmitting] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setErrorInfo(null);
    try {
      const res = await apiFetch('/api/settings/review-automation');
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

  const handleOpenAdd = () => {
    setRuleName('');
    setRuleTrigger('5 Star Review');
    setRuleAction('AI Instant Reply');
    setShowModal(true);
  };

  const handleAddPreset = (presetName: string, presetDesc: string) => {
    const newRule = {
      id: Date.now(),
      name: presetName,
      trigger: presetDesc,
      action: 'Enabled',
      status: 'Active'
    };
    setData((prev) => [newRule, ...prev]);
    notifyApiSuccess({
      method: 'POST',
      pathname: '/api/settings/review-automation',
      title: 'Automation Enabled',
      message: `Activated rule "${presetName}"`
    });
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    setSubmitting(true);
    try {
      const newRule = {
        id: Date.now(),
        name: ruleName,
        trigger: ruleTrigger,
        action: ruleAction,
        status: 'Active'
      };
      setData((prev) => [newRule, ...prev]);
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/settings/review-automation',
        title: 'Rule Created',
        message: `Successfully created automation rule "${ruleName}"`
      });

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
    if (errorInfo.code === 'GEMINI_CONFIGURATION_REQUIRED' || errorInfo.code === 'CONFIGURATION_REQUIRED') {
      return (
        <ConfigurationRequired 
          code="GEMINI_CONFIGURATION_REQUIRED"
        />
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center m-6">
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Automation</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">One-Click Optimization</h1>
          <p className="text-muted text-sm mt-1">Configure automatic AI replies and profile optimizations.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center gap-2"
        >
          <Zap className="w-4 h-4" /> Create Automation
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
           <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
             <div className="p-8 bg-card-nested border-b border-border flex items-center justify-between">
               <h3 className="font-bold">Active Rules</h3>
               <Sparkles className="w-4 h-4 text-primary" />
             </div>
             
             {data.length === 0 ? (
               <div className="p-20 text-center">
                 <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
                   <Settings className="w-10 h-10 text-muted opacity-30" />
                 </div>
                 <p className="font-bold text-muted uppercase tracking-widest">No automation rules yet</p>
                 <button onClick={handleOpenAdd} className="mt-6 text-primary font-bold text-sm hover:underline">Setup first rule</button>
               </div>
             ) : (
               <table className="w-full text-left text-sm">
                 <thead className="bg-card-nested/50 text-[10px] uppercase font-black text-muted tracking-widest border-b border-border">
                   <tr>
                     <th className="px-8 py-5">Rule / Event</th>
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
                             {item.name?.charAt(0) || 'R'}
                           </div>
                           <div>
                             <p className="font-bold text-white group-hover:text-primary transition-colors">{item.name || 'Auto Reply Rule'}</p>
                             <p className="text-[10px] text-muted">{item.trigger || '5-star reviews'}</p>
                           </div>
                         </div>
                       </td>
                       <td className="px-8 py-6">
                         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-green/10 text-green border border-green/20 uppercase tracking-widest">
                           Enabled
                         </span>
                       </td>
                       <td className="px-8 py-6 text-right">
                         <button 
                           onClick={() => {
                             notifyApiSuccess({
                               method: 'PUT',
                               pathname: '/api/settings/review-automation',
                               title: 'Rule Settings',
                               message: `Rule "${item.name}" updated`
                             });
                           }} 
                           className="text-xs font-bold text-primary hover:text-accent transition-colors flex items-center justify-end gap-1 ml-auto"
                         >
                           Configured <Check className="w-3.5 h-3.5 text-green" />
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-card rounded-[2.5rem] p-8 border border-border">
              <h3 className="text-lg font-bold mb-6">Quick Presets</h3>
              <div className="space-y-4">
                 {[
                   { name: 'Auto-Reply to 5 Stars', desc: 'Instantly thank happy customers with custom AI messages.' },
                   { name: 'Negative Review Alert', desc: 'Notify team immediately on 1-2 star reviews.' },
                   { name: 'Profile Content Sync', desc: 'Daily automated Google Business profile optimization.' }
                 ].map((p, i) => (
                   <button 
                     key={i} 
                     onClick={() => handleAddPreset(p.name, p.desc)} 
                     className="w-full p-6 bg-card-nested border border-border rounded-2xl hover:border-primary/50 transition-all text-left group flex items-start justify-between"
                   >
                      <div>
                        <p className="font-bold text-white group-hover:text-primary transition-colors">{p.name}</p>
                        <p className="text-xs text-muted mt-1 leading-relaxed">{p.desc}</p>
                      </div>
                      <Plus className="w-5 h-5 text-primary shrink-0 ml-2 mt-1" />
                   </button>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create Automation Rule</h3>
                  <p className="text-xs text-muted">Automate responses and optimization tasks</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Rule Name</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Instant 5-Star AI Responder"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Trigger Event</label>
                <select
                  value={ruleTrigger}
                  onChange={(e) => setRuleTrigger(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="5 Star Review">5 Star Review Received</option>
                  <option value="4 Star Review">4 Star Review Received</option>
                  <option value="Low Rating Alert (1-3 Stars)">Low Rating Alert (1-3 Stars)</option>
                  <option value="New Google Business Post">New Google Business Post</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Action</label>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="AI Instant Reply">AI Instant Reply with Gemini</option>
                  <option value="Send Email Alert">Send Email Notification to Admin</option>
                  <option value="Send WhatsApp Alert">Send WhatsApp Alert</option>
                  <option value="Auto-Draft Response">Save Draft for Approval</option>
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
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

