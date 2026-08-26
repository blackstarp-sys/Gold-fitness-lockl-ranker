import React, { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';

export default function WebsiteAudit() {
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
      const res = await apiFetch('/api/seo/audit');
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
          title="Website Audit Required"
          message="Please configure a website auditing provider in your settings."
        />
      );
    }
    if (errorInfo.status === 429 || errorInfo.code === 'RATE_LIMITED') {
      return (
        <ConfigurationRequired 
          title="Usage Limit Reached"
          message="Website audit data is temporarily unavailable due to rate limits."
          type="quota"
          onRetry={fetchData}
        />
      );
    }
    return (
      <div className="p-8 bg-danger/10 border border-danger/20 rounded-2xl text-center m-6">
        <h2 className="text-xl font-bold text-danger mb-2">Error Loading Audit</h2>
        <p className="text-muted mb-4">{errorInfo.message}</p>
        <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Website Audit</h1>
          <p className="text-muted text-sm mt-1">Check your website performance and SEO metrics.</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="bg-card rounded-[2.5rem] border border-border p-20 text-center">
          <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-muted opacity-50" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No audit data</h3>
          <p className="text-muted mb-8 max-w-md mx-auto">Run your first audit to see results.</p>
          <button onClick={fetchData} className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/10">
            Start Audit
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-nested text-[10px] uppercase font-black text-muted tracking-widest border-b border-border">
              <tr>
                <th className="px-8 py-5">Metric / URL</th>
                <th className="px-8 py-5">Score</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((item, i) => (
                <tr key={i} className="hover:bg-card-nested/50 transition-colors group">
                  <td className="px-8 py-6 font-bold text-white group-hover:text-primary transition-colors">
                    {item.name || item.keyword || item.businessName || item.platform || 'Item ' + (i+1)}
                  </td>
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-blue/10 text-blue border border-blue/20 uppercase tracking-widest">
                      Analyzed
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="text-xs font-bold text-primary hover:text-accent transition-colors">Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
