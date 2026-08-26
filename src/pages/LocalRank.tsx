import React from 'react';
import GoogleLocalMap from '../components/GoogleLocalMap.tsx';

export default function LocalRank() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Local Rank Checker</h1>
          <p className="text-muted text-sm mt-1">Visualize your business visibility across the local Google Map grid.</p>
        </div>
      </div>

      <GoogleLocalMap 
        businessName="Apex Local Salon"
        initialLat={37.7749}
        initialLng={-122.4194}
      />
    </div>
  );
}

