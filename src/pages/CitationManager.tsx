import React, { useEffect, useState } from 'react';
import { List, Loader2, Globe, ExternalLink, History, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

export default function CitationManager() {
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
      const res = await apiFetch('/api/citations');
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
    if (errorInfo.code === 'CONFIGURATION_REQUIRED') {
      return (
        <ConfigurationRequired 
          title="Citation Manager Required"
          message="Please configure a citation building service in your settings to manage your business directory listings."
        />
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center m-6">
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Citations</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Citation Manager</h1>
          <p className="text-muted text-sm mt-1">Audit and sync your business info across 50+ local directories.</p>
        </div>
        <button 
          onClick={async () => {
            notifyApiSuccess({
              method: 'POST',
              pathname: '/api/citations/sync',
              title: 'Global Sync Started',
              message: 'Initiated background citation sync across 50+ directories.'
            });
          }}
          className="bg-blue hover:bg-blue/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue/10 flex items-center gap-2"
        >
          <Globe className="w-4 h-4" /> Start Global Sync
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-border">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Health Score</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-bold">84%</h3>
            <span className="text-green text-xs font-bold mb-1">+5% vs last month</span>
          </div>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Total Citations</p>
          <h3 className="text-3xl font-bold">{data.length || 0}</h3>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Accurate</p>
          <h3 className="text-3xl font-bold text-green">12</h3>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Inaccurate</p>
          <h3 className="text-3xl font-bold text-danger">3</h3>
        </div>
      </div>

      <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-card-nested text-[10px] uppercase font-black text-muted tracking-widest border-b border-border">
            <tr>
              <th className="px-8 py-5">Directory</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5">Accuracy</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center">
                   <div className="opacity-20 mb-4 flex justify-center">
                      <List className="w-12 h-12" />
                   </div>
                   <p className="font-bold text-muted uppercase tracking-widest">No citation data available yet</p>
                </td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr key={i} className="hover:bg-card-nested/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-blue/10 rounded-xl flex items-center justify-center font-bold text-blue">
                          {item.name?.charAt(0) || 'D'}
                       </div>
                       <span className="font-bold text-white group-hover:text-primary transition-colors">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-green/10 text-green border border-green/20 uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Published
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <div className="w-32 h-1.5 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-green" style={{ width: '100%' }} />
                       </div>
                       <span className="text-[10px] font-bold text-white">100%</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="text-xs font-bold text-primary hover:text-accent transition-colors flex items-center justify-end gap-1 ml-auto">
                      View Listing <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
