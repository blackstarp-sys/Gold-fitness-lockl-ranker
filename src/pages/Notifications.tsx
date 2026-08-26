import React from 'react';
import { Bell, Search, Filter, MoreHorizontal, CheckCircle2, MessageSquare, Star, Zap } from 'lucide-react';

export default function Notifications() {
  const notifications = [
    { id: 1, type: 'review', title: 'New 5-Star Review', desc: 'Rahul Sharma left a positive review for Dhanus Gold Fitness.', time: '2 hours ago', unread: true, icon: Star, color: 'text-orange bg-orange/10' },
    { id: 2, type: 'system', title: 'Weekly Report Ready', desc: 'Your performance report for Aug 14 - Aug 21 is now available.', time: '5 hours ago', unread: true, icon: CheckCircle2, color: 'text-green bg-green/10' },
    { id: 3, type: 'ai', title: 'Post Idea Generated', desc: 'Gemini has suggested 3 new post ideas based on your recent activity.', time: 'Yesterday', unread: false, icon: Zap, color: 'text-accent bg-accent/10' },
    { id: 4, type: 'message', title: 'WhatsApp Connected', desc: 'Your business number +91 98765 43210 is now active.', time: '2 days ago', unread: false, icon: MessageSquare, color: 'text-blue bg-blue/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted text-sm mt-1">Stay updated with reviews, alerts, and AI insights.</p>
        </div>
        <div className="flex gap-3">
           <button className="p-3 bg-card border border-border rounded-xl text-muted hover:text-white transition-all">
              <Filter className="w-5 h-5" />
           </button>
           <button className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10">
              Mark all as read
           </button>
        </div>
      </div>

      <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-20 text-center">
             <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
                <Bell className="w-10 h-10 text-muted opacity-30" />
             </div>
             <p className="font-bold text-muted uppercase tracking-widest">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
             {notifications.map((n) => (
               <div key={n.id} className={`p-8 flex items-start gap-6 transition-colors hover:bg-card-nested/30 ${n.unread ? 'bg-primary/5' : ''}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${n.color}`}>
                     <n.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-bold ${n.unread ? 'text-white' : 'text-slate-300'}`}>{n.title}</h3>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{n.time}</span>
                     </div>
                     <p className="text-sm text-muted leading-relaxed">{n.desc}</p>
                     <div className="flex gap-4 mt-4">
                        <button className="text-xs font-bold text-primary hover:underline">View Details</button>
                        <button className="text-xs font-bold text-muted hover:text-white">Dismiss</button>
                     </div>
                  </div>
                  <div className="flex flex-col items-end gap-4">
                     {n.unread && <div className="w-2 h-2 bg-primary rounded-full" />}
                     <button className="text-muted hover:text-white">
                        <MoreHorizontal className="w-5 h-5" />
                     </button>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
