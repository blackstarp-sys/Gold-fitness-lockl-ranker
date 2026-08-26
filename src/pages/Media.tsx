import React from 'react';
import { ImageIcon, Loader2, Upload, Camera, Play } from 'lucide-react';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';

export default function Media() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Photos & Videos</h1>
          <p className="text-muted text-sm mt-1">Manage and optimize your Google Business Profile visual content.</p>
        </div>
        <button className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/10 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload Media
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
           <div className="bg-card rounded-[2.5rem] border border-border p-20 text-center">
              <div className="w-20 h-20 bg-card-nested rounded-3xl border border-border flex items-center justify-center mx-auto mb-6">
                <Camera className="w-10 h-10 text-muted opacity-30" />
              </div>
              <ConfigurationRequired 
                title="Google Media Sync Required" 
                message="No media found for your Google Business Profile. Sync your account to manage existing photos or upload new ones." 
              />
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-card rounded-[2.5rem] p-8 border border-border">
              <h3 className="font-bold mb-6">Media Categories</h3>
              <div className="space-y-4">
                 {[
                   { name: 'Exterior', icon: Camera, count: 0 },
                   { name: 'Interior', icon: Camera, count: 0 },
                   { name: 'Product', icon: ImageIcon, count: 0 },
                   { name: 'Videos', icon: Play, count: 0 },
                 ].map((cat, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-card-nested rounded-2xl border border-border/50">
                      <div className="flex items-center gap-3">
                         <cat.icon className="w-4 h-4 text-muted" />
                         <span className="text-sm font-bold text-white">{cat.name}</span>
                      </div>
                      <span className="text-xs font-bold text-muted">{cat.count}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
