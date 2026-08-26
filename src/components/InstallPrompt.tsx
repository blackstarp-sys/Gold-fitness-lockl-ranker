'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event (fired by Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the native install prompt
    deferredPrompt.prompt();
    
    // Wait for user to respond
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-blue-600 text-white p-4 rounded-xl shadow-xl flex items-center justify-between z-50">
      <div className="flex flex-col">
        <span className="font-semibold text-sm">Install RankLocal</span>
        <span className="text-xs text-blue-100">Get the full mobile app experience.</span>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={handleInstallClick}
          className="px-3 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50"
        >
          <Download className="w-4 h-4 inline-block mr-1" /> Install
        </button>
        <button onClick={() => setShowPrompt(false)} className="p-1 hover:bg-blue-700 rounded-lg">
          <X className="w-5 h-5 text-blue-200" />
        </button>
      </div>
    </div>
  );
}
