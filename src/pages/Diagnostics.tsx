import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, XCircle, RefreshCw, Server, Globe, Database, ShieldCheck, Check } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { notifyApiSuccess } from '../context/ToastContext.tsx';

interface HealthCheckResult {
  endpoint: string;
  status: 'pending' | 'success' | 'error';
  statusCode?: number;
  data?: any;
  error?: string;
  timeMs?: number;
}

export default function Diagnostics() {
  const [healthStatus, setHealthStatus] = useState<HealthCheckResult>({
    endpoint: '/api/health',
    status: 'pending'
  });

  const [endpoints, setEndpoints] = useState<HealthCheckResult[]>([
    { endpoint: '/api/health', status: 'pending' },
    { endpoint: '/api/google/status', status: 'pending' },
    { endpoint: '/api/dashboard/summary', status: 'pending' },
    { endpoint: '/api/settings', status: 'pending' }
  ]);

  const [isChecking, setIsChecking] = useState(false);

  const runDiagnostics = async () => {
    setIsChecking(true);
    const updated = [...endpoints];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      const start = performance.now();
      try {
        let resData: any;
        if (item.endpoint === '/api/health') {
          // Direct fetch to verify server bypass token
          const raw = await fetch('/api/health');
          resData = await raw.json();
          item.statusCode = raw.status;
        } else {
          resData = await apiFetch(item.endpoint, {
            optionalAuth: item.endpoint === '/api/google/status'
          });
          item.statusCode = 200;
        }
        const duration = Math.round(performance.now() - start);
        item.status = 'success';
        item.data = resData;
        item.timeMs = duration;
        item.error = undefined;
      } catch (err: any) {
        const duration = Math.round(performance.now() - start);
        item.status = 'error';
        item.error = err?.message || 'Failed to fetch';
        item.statusCode = err?.status || 500;
        item.timeMs = duration;
      }
      setEndpoints([...updated]);
    }

    setHealthStatus(updated[0]);
    setIsChecking(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">System Diagnostics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20">
              Live Inspector
            </span>
          </div>
          <p className="text-muted text-sm mt-1">
            Test backend reachability and core API endpoints in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              notifyApiSuccess({
                method: 'POST',
                pathname: '/api/settings/save',
                message: 'Configuration successfully updated and verified.',
                title: 'Settings Saved'
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-extrabold text-xs border border-emerald-500/30 transition-all"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            Test Success Toast
          </button>

          <button
            onClick={runDiagnostics}
            disabled={isChecking}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-black font-extrabold text-xs shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            Run Health Scan
          </button>
        </div>
      </div>

      {/* Main Server Health Banner */}
      <div className={`p-6 rounded-3xl border-2 transition-all shadow-xl ${
        healthStatus.status === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : healthStatus.status === 'error'
          ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : 'bg-card border-border text-muted'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl ${
              healthStatus.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}>
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase font-bold tracking-wider opacity-80">Backend Server Status</div>
              <div className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
                {healthStatus.status === 'success' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Backend Server Reachable (HTTP 200)</span>
                  </>
                )}
                {healthStatus.status === 'error' && (
                  <>
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span>Backend Server Unreachable / Error</span>
                  </>
                )}
                {healthStatus.status === 'pending' && <span>Testing connection...</span>}
              </div>
            </div>
          </div>

          {healthStatus.timeMs !== undefined && (
            <div className="text-right">
              <span className="text-2xl font-mono font-bold text-white">{healthStatus.timeMs}ms</span>
              <div className="text-[10px] text-muted uppercase font-bold">Latency</div>
            </div>
          )}
        </div>
      </div>

      {/* Endpoint Inspection Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Endpoint Diagnostics Matrix
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {endpoints.map((ep) => (
            <div key={ep.endpoint} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                  GET {ep.endpoint}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  ep.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  ep.status === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {ep.status === 'success' ? `HTTP ${ep.statusCode || 200}` : ep.status === 'error' ? `FAILED (${ep.statusCode || 500})` : 'CHECKING'}
                </span>
              </div>

              {ep.error ? (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/20 p-3 rounded-xl font-mono">
                  Error: {ep.error}
                </div>
              ) : ep.data ? (
                <pre className="text-[11px] text-slate-300 bg-background/80 border border-border/80 p-3 rounded-xl font-mono overflow-x-auto max-h-32">
                  {JSON.stringify(ep.data, null, 2)}
                </pre>
              ) : (
                <div className="text-xs text-muted">Awaiting response...</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
