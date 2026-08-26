import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MousePointerClick, Search, Eye, PhoneCall, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export default function Analytics() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { apiFetch } = useAuth();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/analytics');
      if (res && res.performance) {
        setData(res.performance);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totals = data.reduce((acc, curr) => ({
    views: acc.views + curr.views,
    searches: acc.searches + curr.searches,
    interactions: acc.interactions + curr.interactions,
  }), { views: 0, searches: 0, interactions: 0 });

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted text-sm mt-1">Track how customers are finding and interacting with your Google Profile.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Total Views', value: totals.views.toLocaleString(), icon: Eye, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total Searches', value: totals.searches.toLocaleString(), icon: Search, color: 'text-accent', bg: 'bg-accent/10' },
          { label: 'Interactions', value: totals.interactions.toLocaleString(), icon: MousePointerClick, color: 'text-green', bg: 'bg-green/10' },
          { label: 'Phone Calls', value: 'N/A', icon: PhoneCall, color: 'text-orange', bg: 'bg-orange/10' }
        ].map((stat, i) => (
          <div key={i} className="bg-card p-8 rounded-[2.5rem] border border-border flex items-center gap-6 hover:translate-y-[-4px] transition-all duration-300 group">
            <div className={`p-5 rounded-2xl ${stat.bg} group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="bg-card p-20 rounded-[2.5rem] border border-border text-center">
           <p className="text-muted font-bold uppercase tracking-widest">No performance data available yet. Please sync your profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pb-12">
          {/* Profile Views Chart */}
          <div className="bg-card p-10 rounded-[2.5rem] border border-border">
            <h3 className="text-xl font-bold text-white mb-10">Views vs Searches</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dy={15} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dx={-15} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101B30', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', fontSize: '12px', fontWeight: 'bold' }} 
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px' }} />
                  <Line type="monotone" dataKey="views" name="Profile Views" stroke="#7257F5" strokeWidth={5} dot={{ r: 5, fill: '#7257F5', strokeWidth: 3, stroke: '#101B30' }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="searches" name="Searches" stroke="#9A89FF" strokeWidth={5} dot={{ r: 5, fill: '#9A89FF', strokeWidth: 3, stroke: '#101B30' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Customer Interactions Chart */}
          <div className="bg-card p-10 rounded-[2.5rem] border border-border">
            <h3 className="text-xl font-bold text-white mb-10">Customer Interactions</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dy={15} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dx={-15} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#101B30', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', fontSize: '12px', fontWeight: 'bold' }} 
                    cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 15 }} 
                  />
                  <Bar dataKey="interactions" name="Total Actions" fill="#22C55E" radius={[10, 10, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
