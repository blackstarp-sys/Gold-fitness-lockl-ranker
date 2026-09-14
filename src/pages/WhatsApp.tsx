import React, { useEffect, useState } from 'react';
import { Send, Loader2, AlertCircle, Plus, X, MoreVertical, MessageSquare, History, PhoneCall, FileText, Trash2, Sparkles, Check, CheckSquare, Square, MinusSquare, PowerOff, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';
import WhatsAppTemplateManager from '../components/WhatsAppTemplateManager.tsx';

export default function WhatsApp() {
  const [activeTab, setActiveTab] = useState<'templates' | 'numbers'>('numbers');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setErrorInfo(null);
    try {
      const res = await apiFetch('/api/settings/whatsapp');
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

  const handleToggleAutoReply = async (id: string | number, nextStatus: boolean) => {
    setUpdatingId(id);
    const prevData = [...data];
    // Optimistic UI update
    setData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, autoReply: nextStatus } : item))
    );

    try {
      const res = await apiFetch(`/api/settings/whatsapp/${id}/auto-reply`, {
        method: 'PATCH',
        body: JSON.stringify({ autoReply: nextStatus }),
      });

      if (res?.accounts && Array.isArray(res.accounts)) {
        setData(res.accounts);
      }

      const targetAccount = data.find((item) => item.id === id);
      notifyApiSuccess({
        method: 'PATCH',
        pathname: `/api/settings/whatsapp/${id}/auto-reply`,
        title: nextStatus ? 'Auto-Reply Enabled' : 'Auto-Reply Paused',
        message: `Auto-reply status updated in database to ${nextStatus ? 'active' : 'disabled'} for ${targetAccount?.phoneNumber || targetAccount?.name || 'number'}.`,
      });
    } catch (err: any) {
      console.error('Failed to update WhatsApp auto-reply:', err);
      // Revert optimistic update
      setData(prevData);
      alert(err.message || 'Failed to update auto-reply status in database.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllSelected = data.length > 0 && data.every((item) => selectedIds.includes(item.id));
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map((item) => item.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkAutoReply = async (enable: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    const targetIds = [...selectedIds];
    const prevData = [...data];

    // Optimistic UI update
    setData((prev) =>
      prev.map((item) =>
        targetIds.includes(item.id) ? { ...item, autoReply: enable } : item
      )
    );

    try {
      const res = await apiFetch('/api/settings/whatsapp/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: enable ? 'enable_auto_reply' : 'disable_auto_reply',
          ids: targetIds,
        }),
      });

      if (res?.accounts && Array.isArray(res.accounts)) {
        setData(res.accounts);
      }

      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/settings/whatsapp/bulk',
        title: enable ? 'Bulk Auto-Reply Enabled' : 'Bulk Auto-Reply Paused',
        message: `Updated auto-reply status for ${targetIds.length} WhatsApp number(s) in the database.`,
      });
    } catch (err: any) {
      console.error('Bulk auto-reply update failed:', err);
      setData(prevData);
      alert(err.message || 'Failed to update bulk auto-reply status.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (!confirm(`Are you sure you want to disconnect ${count} selected WhatsApp account(s)?`)) {
      return;
    }

    setBulkProcessing(true);
    const targetIds = [...selectedIds];
    const prevData = [...data];

    // Optimistic UI update
    setData((prev) => prev.filter((item) => !targetIds.includes(item.id)));
    setSelectedIds([]);

    try {
      const res = await apiFetch('/api/settings/whatsapp/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'remove',
          ids: targetIds,
        }),
      });

      if (res?.accounts && Array.isArray(res.accounts)) {
        setData(res.accounts);
      }

      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/settings/whatsapp/bulk',
        title: 'Accounts Disconnected',
        message: `Removed ${count} WhatsApp account(s) from your database.`,
      });
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      setData(prevData);
      setSelectedIds(targetIds);
      alert(err.message || 'Failed to remove selected accounts.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleConnectNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/settings/whatsapp', {
        method: 'POST',
        body: JSON.stringify({
          name: accountName || 'Business WhatsApp',
          phoneNumber,
          autoReply: autoReplyEnabled,
        }),
      });

      if (res?.accounts && Array.isArray(res.accounts)) {
        setData(res.accounts);
      } else if (res?.account) {
        setData((prev) => [res.account, ...prev]);
      } else {
        await fetchData();
      }

      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/settings/whatsapp',
        title: 'WhatsApp Connected',
        message: `Linked WhatsApp number ${phoneNumber} (Auto-reply: ${autoReplyEnabled ? 'Enabled' : 'Disabled'})`,
      });

      setAccountName('');
      setPhoneNumber('');
      setAutoReplyEnabled(true);
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to connect WhatsApp number');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNumber = async (id: string | number, nameOrPhone: string) => {
    if (!confirm(`Are you sure you want to disconnect WhatsApp number "${nameOrPhone}"?`)) return;

    try {
      await apiFetch(`/api/settings/whatsapp/${id}`, {
        method: 'DELETE',
      });
      setData((prev) => prev.filter((item) => item.id !== id));
      notifyApiSuccess({
        method: 'DELETE',
        pathname: `/api/settings/whatsapp/${id}`,
        title: 'Number Disconnected',
        message: `Removed WhatsApp account ${nameOrPhone}`,
      });
    } catch (err: any) {
      console.error('Failed to remove WhatsApp number:', err);
      alert(err?.message || 'Failed to remove WhatsApp number');
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
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading WhatsApp</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Integration</h1>
          <p className="text-muted text-sm mt-1">Send review requests, manage message templates, and track customer communications.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-green hover:bg-green/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-green/10 flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Connect Number
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          onClick={() => setActiveTab('numbers')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'numbers'
              ? 'bg-green text-white shadow-lg shadow-green/20'
              : 'bg-card text-muted hover:text-white border border-border hover:bg-card-nested'
          }`}
        >
          <PhoneCall className="w-4 h-4" /> Connected Numbers & Logs ({data.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'bg-green text-white shadow-lg shadow-green/20'
              : 'bg-card text-muted hover:text-white border border-border hover:bg-card-nested'
          }`}
        >
          <FileText className="w-4 h-4" /> Review Request Templates
        </button>
      </div>

      {activeTab === 'templates' ? (
        <WhatsAppTemplateManager />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden shadow-sm">
              <div className="p-8 bg-card-nested border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">Connected Accounts</h3>
                  <p className="text-xs text-muted mt-0.5">Manage numbers, automated reply rules, and batch configurations</p>
                </div>
                <div className="flex items-center gap-3">
                  {selectedIds.length > 0 && (
                    <span className="text-xs text-green font-bold bg-green/10 px-3 py-1 rounded-full border border-green/20">
                      {selectedIds.length} of {data.length} selected
                    </span>
                  )}
                  <span className="text-xs bg-card px-3 py-1 rounded-full border border-border text-muted font-bold">
                    {data.length} Linked Number{data.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Bulk Action Toolbar */}
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-b border-green/30 bg-green/10"
                  >
                    <div className="px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-green text-white shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {selectedIds.length} Selected
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          disabled={bulkProcessing}
                          className="text-xs text-muted hover:text-white transition-colors underline underline-offset-2"
                        >
                          Deselect all
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={bulkProcessing}
                          onClick={() => handleBulkAutoReply(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-card border border-green/30 hover:border-green text-green hover:bg-green/20 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {bulkProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Enable Auto-Reply
                        </button>

                        <button
                          type="button"
                          disabled={bulkProcessing}
                          onClick={() => handleBulkAutoReply(false)}
                          className="px-3.5 py-1.5 rounded-xl bg-card border border-border hover:border-muted text-muted hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {bulkProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <PowerOff className="w-3.5 h-3.5" />
                          )}
                          Disable Auto-Reply
                        </button>

                        <button
                          type="button"
                          disabled={bulkProcessing}
                          onClick={handleBulkDelete}
                          className="px-3.5 py-1.5 rounded-xl bg-danger/10 border border-danger/30 hover:bg-danger/20 text-danger text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove ({selectedIds.length})
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {data.length === 0 ? (
                <div className="p-20 text-center">
                   <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
                     <MessageSquare className="w-10 h-10 text-muted opacity-30" />
                   </div>
                   <p className="font-bold text-muted uppercase tracking-widest mb-6">No WhatsApp accounts connected</p>
                   <button onClick={() => setShowModal(true)} className="bg-green hover:bg-green/90 text-white px-8 py-3 rounded-2xl font-bold transition-all">
                     Connect Your First Number
                   </button>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-card-nested/50 text-[10px] uppercase font-black text-muted tracking-widest border-b border-border">
                    <tr>
                      <th className="w-12 px-6 py-5">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="select-all-whatsapp"
                            aria-label="Select all accounts"
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeSelected;
                            }}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-border bg-background text-green focus:ring-green/30 focus:ring-2 cursor-pointer accent-green"
                          />
                        </div>
                      </th>
                      <th className="px-6 py-5">Number / Account</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5">AI Auto-Reply</th>
                      <th className="px-6 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.map((item, i) => {
                      const isAutoReplyOn = Boolean(item.autoReply);
                      const isUpdating = updatingId === item.id;
                      const isSelected = selectedIds.includes(item.id);
                      return (
                        <tr
                          key={item.id || i}
                          className={`transition-colors group ${
                            isSelected ? 'bg-green/[0.07]' : 'hover:bg-card-nested/50'
                          }`}
                        >
                          <td className="w-12 px-6 py-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`select-whatsapp-${item.id}`}
                                aria-label={`Select account ${item.phoneNumber || item.name}`}
                                checked={isSelected}
                                onChange={() => handleToggleSelect(item.id)}
                                className="w-4 h-4 rounded border-border bg-background text-green focus:ring-green/30 focus:ring-2 cursor-pointer accent-green"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-green/10 rounded-xl flex items-center justify-center font-bold text-green shrink-0">
                                  {item.name?.charAt(0) || 'W'}
                               </div>
                               <div>
                                  <p className="font-bold text-white group-hover:text-primary transition-colors">{item.name || 'Business Number'}</p>
                                  <p className="text-[11px] text-muted font-mono tracking-wide">{item.phoneNumber || 'Not verified'}</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-green/10 text-green border border-green/20 uppercase tracking-widest">
                              <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" /> {item.status || 'Connected'}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                role="switch"
                                id={`toggle-whatsapp-autoreply-${item.id}`}
                                aria-label={`Toggle auto-reply for ${item.phoneNumber || item.name}`}
                                aria-checked={isAutoReplyOn}
                                disabled={isUpdating}
                                onClick={() => handleToggleAutoReply(item.id, !isAutoReplyOn)}
                                className={`w-12 h-6.5 rounded-full transition-all duration-200 relative flex items-center px-0.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-green/30 ${
                                  isAutoReplyOn 
                                    ? 'bg-green shadow-sm shadow-green/20' 
                                    : 'bg-background border border-border hover:border-muted/50'
                                } ${isUpdating ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 flex items-center justify-center ${
                                    isAutoReplyOn ? 'translate-x-5.5' : 'translate-x-0'
                                  }`}
                                >
                                  {isUpdating && (
                                    <Loader2 className="w-3 h-3 text-muted animate-spin" />
                                  )}
                                </div>
                              </button>
                              <div className="flex flex-col">
                                <span className={`text-xs font-bold flex items-center gap-1 transition-colors ${
                                  isAutoReplyOn ? 'text-green' : 'text-muted'
                                }`}>
                                  {isAutoReplyOn && <Sparkles className="w-3 h-3" />}
                                  {isAutoReplyOn ? 'Auto-Reply On' : 'Paused'}
                                </span>
                                <span className="text-[10px] text-muted">
                                  {isAutoReplyOn ? 'Syncs with database' : 'Manual messaging'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <button 
                              onClick={() => handleDeleteNumber(item.id, item.phoneNumber || item.name)}
                              title="Disconnect number"
                              className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-card rounded-[2.5rem] p-8 border border-border">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                  <History className="w-5 h-5 text-muted" /> Recent Message Logs
                </h3>
                <div className="space-y-4">
                   {[
                     { num: '+1 (555) 019-2834', time: '4m ago', snippet: '"Thank you for your rating! Our team is thrilled you enjoyed your session."' },
                     { num: '+1 (555) 438-9210', time: '18m ago', snippet: '"Hi Alex! We would love your feedback on Google: https://g.page/r/example/review"' },
                     { num: '+1 (555) 019-2834', time: '1h ago', snippet: '"Hello Jordan, your appointment has been confirmed with Dhanus Gold Fitness."' }
                   ].map((log, i) => (
                     <div key={i} className="p-4 bg-card-nested rounded-2xl border border-border/50 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-white font-mono">{log.num}</span>
                          <span className="text-[10px] text-muted font-bold">{log.time}</span>
                        </div>
                        <p className="text-xs text-muted italic line-clamp-2">{log.snippet}</p>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              className="bg-card border border-border rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green/10 text-green rounded-2xl">
                    <PhoneCall className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Connect WhatsApp</h3>
                    <p className="text-xs text-muted">Link a WhatsApp Business phone number</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="text-muted hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConnectNumber} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Account / Branch Name</label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Downtown Studio Support"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">WhatsApp Phone Number</label>
                  <input
                    type="text"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="p-4 bg-card-nested rounded-2xl border border-border flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-green" /> Enable AI Auto-Reply
                    </p>
                    <p className="text-[11px] text-muted">
                      Automatically respond to customer inquiries and review follow-ups
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoReplyEnabled}
                    onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                      autoReplyEnabled ? 'bg-green' : 'bg-background border border-border'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        autoReplyEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-card-nested text-muted hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-green hover:bg-green/90 text-white text-xs font-bold shadow-lg shadow-green/20 flex items-center gap-2 transition-all"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Connect Number
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

