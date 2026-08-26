import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.tsx';
import InstallPrompt from './InstallPrompt.tsx';
import { Menu, X } from 'lucide-react';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex text-slate-100 flex-col lg:flex-row">
      {/* Mobile Top Navigation Header */}
      <div className="lg:hidden bg-sidebar border-b border-border p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white">
            D
          </div>
          <span className="font-bold text-lg tracking-tight text-white">Local Ranker</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-xl bg-card border border-border text-muted hover:text-white transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-[280px] p-4 sm:p-8 overflow-x-hidden min-w-0">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      <InstallPrompt />
    </div>
  );
}

