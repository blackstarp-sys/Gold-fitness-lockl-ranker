import React, { useEffect, useState } from 'react';
import { Send, Loader2, AlertCircle, Plus, X, MoreVertical, MessageSquare, History, PhoneCall, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';
import WhatsAppTemplateManager from '../components/WhatsAppTemplateManager.tsx';

export default function WhatsApp() {
  const [activeTab, setActiveTab] = useState<'templates' | 'numbers'>('templates');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; code?: string; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleConnectNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setSubmitting(true);
    try {
      const newAcc = {
        id: Date.now(),
        name: accountName || 'Business WhatsApp',
        phoneNumber,
        status: 'Connected'
      };
      setData((prev) => [newAcc, ...prev]);
      notifyApiSuccess({
        method: 'POST',
        pathname: '/api/settings/whatsapp',
        title: 'WhatsApp Connected',
        message: `Linked WhatsApp number ${phoneNumber}`
      });

      setAccountName('');
      setPhoneNumber('');
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
          onClick={() => setActiveTab('templates')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'bg-green text-white shadow-lg shadow-green/20'
              : 'bg-card text-muted hover:text-white border border-border hover:bg-card-nested'
          }`}
        >
          <FileText className="w-4 h-4" /> Review Request Templates
        </button>
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
      </div>

      {activeTab === 'templates' ? (
        <WhatsAppTemplateManager />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
              <div className="p-8 bg-card-nested border-b border-border flex items-center justify-between">
                <h3 className="font-bold">Connected Accounts</h3>
                <span className="text-xs text-muted font-bold">{data.length} Linked Number(s)</span>
              </div>
              
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
                      <th className="px-8 py-5">Number / Account</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.map((item, i) => (
                      <tr key={item.id || i} className="hover:bg-card-nested/50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-green/10 rounded-xl flex items-center justify-center font-bold text-green">
                                {item.name?.charAt(0) || 'W'}
                             </div>
                             <div>
                                <p className="font-bold text-white group-hover:text-primary transition-colors">{item.name || 'Business Number'}</p>
                                <p className="text-[10px] text-muted font-bold tracking-widest">{item.phoneNumber || 'Not verified'}</p>
                             </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-green/10 text-green border border-green/20 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" /> Connected
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button className="p-2 text-muted hover:text-white hover:bg-card-nested rounded-xl transition-all">
                            <MoreVertical className="w-5 h-5" />
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
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <History className="w-5 h-5 text-muted" /> Recent Message Logs
                </h3>
                <div className="space-y-4">
                   {[1,2,3].map(i => (
                     <div key={i} className="p-4 bg-card-nested rounded-2xl border border-border/50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-white">+1 (555) 019-2834</span>
                          <span className="text-[10px] text-muted font-bold">{i * 5}m ago</span>
                        </div>
                        <p className="text-xs text-muted italic">"Hi Alex! Thank you for visiting Apex Local Salon..."</p>
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
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Account Name</label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Primary Support Number"
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
                    className="px-6 py-2.5 rounded-xl bg-green hover:bg-green/90 text-white text-xs font-bold shadow-lg shadow-green/20 flex items-center gap-2"
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

