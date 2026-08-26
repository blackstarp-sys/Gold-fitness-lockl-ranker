// Source: Google Maps Platform Code Assist
import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Layers, Search, RefreshCw, Key, ShieldCheck, Database, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';

interface GridPoint {
  id: string;
  lat: number;
  lng: number;
  rank: number;
  label: string;
}

interface GoogleLocalMapProps {
  businessName?: string;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  onLocationSelect?: (lat: number, lng: number, address: string) => void;
}

export default function GoogleLocalMap({
  businessName = "Apex Local Salon",
  initialLat = 37.7749,
  initialLng = -122.4194,
  onLocationSelect
}: GoogleLocalMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  
  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [zoom, setZoom] = useState(13);
  const [selectedPoint, setSelectedPoint] = useState<GridPoint | null>(null);
  const [gridPoints, setGridPoints] = useState<GridPoint[]>([]);
  const [radiusMiles, setRadiusMiles] = useState(3);
  const [keyword, setKeyword] = useState("hair salon near me");
  const [savingToFirebase, setSavingToFirebase] = useState(false);
  const [firebaseSaved, setFirebaseSaved] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [activeApiKey, setActiveApiKey] = useState(apiKey);

  // Generate local search rank grid points around center
  useEffect(() => {
    generateGrid(center.lat, center.lng, radiusMiles);
  }, [center.lat, center.lng, radiusMiles]);

  const generateGrid = (lat: number, lng: number, miles: number) => {
    const points: GridPoint[] = [];
    const latDelta = (miles / 69.0) / 2;
    const lngDelta = (miles / (69.0 * Math.cos(lat * (Math.PI / 180)))) / 2;
    
    let idCounter = 1;
    // 3x3 Grid
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        const pLat = lat + r * latDelta;
        const pLng = lng + c * lngDelta;
        // Mock rank for demonstration (1 is top rank)
        const distanceFactor = Math.abs(r) + Math.abs(c);
        const rank = distanceFactor === 0 ? 1 : Math.min(20, Math.floor(distanceFactor * 2.5 + (idCounter % 3)));
        
        points.push({
          id: `gp-${idCounter}`,
          lat: pLat,
          lng: pLng,
          rank,
          label: `Point #${idCounter}`
        });
        idCounter++;
      }
    }
    setGridPoints(points);
  };

  const saveLocationToFirestore = async () => {
    setSavingToFirebase(true);
    try {
      await addDoc(collection(db, 'locations'), {
        name: businessName,
        lat: center.lat,
        lng: center.lng,
        radiusMiles,
        keyword,
        userId: 'demo_user',
        updatedAt: serverTimestamp()
      });
      setFirebaseSaved(true);
      setTimeout(() => setFirebaseSaved(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'locations');
    } finally {
      setSavingToFirebase(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank <= 3) return { bg: '#22c55e', border: '#16a34a', text: '#ffffff' }; // Green
    if (rank <= 9) return { bg: '#eab308', border: '#ca8a04', text: '#ffffff' }; // Yellow
    return { bg: '#ef4444', border: '#dc2626', text: '#ffffff' }; // Red
  };

  const effectiveKey = activeApiKey || customKeyInput;

  return (
    <div className="bg-card rounded-[2.5rem] border border-border p-6 space-y-6 shadow-xl overflow-hidden">
      {/* Map Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green" /> Google Maps Local Grid Rank
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-green/10 text-green border border-green/20 uppercase tracking-widest">
              Live Interactive Map
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Tracking rank grid for <strong className="text-white">{businessName}</strong> around ({center.lat.toFixed(4)}, {center.lng.toFixed(4)})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveLocationToFirestore}
            disabled={savingToFirebase}
            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {firebaseSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green" /> Saved to Firebase!
              </>
            ) : (
              <>
                <Database className="w-4 h-4" /> Save to Firestore
              </>
            )}
          </button>
          
          <button
            onClick={() => generateGrid(center.lat, center.lng, radiusMiles)}
            className="p-2 bg-card-nested hover:bg-border text-muted hover:text-white rounded-xl border border-border transition-all"
            title="Recalculate Grid"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card-nested p-4 rounded-2xl border border-border/60">
        <div>
          <label className="text-[10px] font-black text-muted uppercase tracking-wider block mb-1">Target Keyword</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-green"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted uppercase tracking-wider block mb-1">Grid Radius (Miles)</label>
          <select
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-green"
          >
            <option value={1}>1 Mile (Dense Urban)</option>
            <option value={3}>3 Miles (Suburban)</option>
            <option value={5}>5 Miles (Metro Area)</option>
            <option value={10}>10 Miles (Regional)</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted uppercase tracking-wider block mb-1">Grid Density</label>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-bold text-white bg-card px-3 py-1 rounded-lg border border-border">
              3 x 3 Grid (9 Points)
            </span>
            <div className="flex gap-1.5 ml-auto">
              <span className="w-3 h-3 rounded-full bg-green" title="Rank 1-3" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" title="Rank 4-9" />
              <span className="w-3 h-3 rounded-full bg-red-500" title="Rank 10+" />
            </div>
          </div>
        </div>
      </div>

      {/* Map View Container */}
      <div className="relative w-full h-[450px] rounded-2xl overflow-hidden border border-border shadow-inner bg-slate-900">
        {!effectiveKey ? (
          <div className="absolute inset-0 bg-card/95 backdrop-blur z-20 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-green/10 rounded-2xl border border-green/20 flex items-center justify-center">
              <Key className="w-7 h-7 text-green" />
            </div>
            <div className="max-w-md space-y-2">
              <h4 className="text-lg font-bold text-white">Google Maps API Key Required</h4>
              <p className="text-xs text-muted">
                To activate full interactive vector map rendering, provide your Google Maps API key or use the free Maps Demo Key.
              </p>
            </div>
            <div className="w-full max-w-sm flex gap-2">
              <input
                type="text"
                placeholder="AIzaSy..."
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                className="flex-1 bg-card-nested border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green"
              />
              <button
                onClick={() => setActiveApiKey(customKeyInput)}
                className="bg-green hover:bg-green/90 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                Activate Map
              </button>
            </div>
          </div>
        ) : (
          <APIProvider apiKey={effectiveKey}>
            <Map
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              defaultCenter={center}
              defaultZoom={zoom}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              {/* Center Business Pin */}
              <AdvancedMarker position={center} title={businessName}>
                <div className="relative group cursor-pointer">
                  <div className="w-10 h-10 bg-green rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white animate-bounce">
                    <Navigation className="w-5 h-5 fill-white" />
                  </div>
                </div>
              </AdvancedMarker>

              {/* Grid Points */}
              {gridPoints.map((pt) => {
                const color = getRankColor(pt.rank);
                return (
                  <AdvancedMarker
                    key={pt.id}
                    position={{ lat: pt.lat, lng: pt.lng }}
                    onClick={() => setSelectedPoint(pt)}
                  >
                    <Pin
                      background={color.bg}
                      borderColor={color.border}
                      glyphColor={color.text}
                      glyph={`${pt.rank}`}
                    />
                  </AdvancedMarker>
                );
              })}

              {/* Info Window */}
              {selectedPoint && (
                <InfoWindow
                  position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                  onCloseClick={() => setSelectedPoint(null)}
                >
                  <div className="p-2 text-slate-900 space-y-1">
                    <div className="font-bold text-xs flex items-center justify-between gap-4">
                      <span>{selectedPoint.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold text-white ${
                        selectedPoint.rank <= 3 ? 'bg-green-600' : selectedPoint.rank <= 9 ? 'bg-yellow-600' : 'bg-red-600'
                      }`}>
                        Rank #{selectedPoint.rank}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Keyword: "{keyword}"
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Lat: {selectedPoint.lat.toFixed(4)}, Lng: {selectedPoint.lng.toFixed(4)}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        )}
      </div>

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[11px] text-muted border-t border-border pt-4">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-green" /> Powered by Google Maps Platform & Firebase Firestore
        </span>
        <a 
          href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:underline text-muted"
        >
          Google Maps Platform Terms
        </a>
      </div>
    </div>
  );
}
