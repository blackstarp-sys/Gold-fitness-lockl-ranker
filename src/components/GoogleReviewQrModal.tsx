import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Printer,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
  Star,
  ExternalLink,
  Edit3,
  Layers,
  Palette,
  FileText,
  Building,
  Image as ImageIcon,
  Info
} from 'lucide-react';

interface GoogleReviewQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string;
  googlePlaceId?: string;
  websiteUri?: string;
}

type TemplateType = 'standee' | 'poster' | 'card' | 'badge';
type ColorTheme = 'gold' | 'dark' | 'monochrome' | 'emerald';

export default function GoogleReviewQrModal({
  isOpen,
  onClose,
  businessName = "Dhanu's Gold Fitness",
  googlePlaceId = '',
  websiteUri = 'https://www.dhanusgoldfitness.com'
}: GoogleReviewQrModalProps) {
  // Review Link State
  const defaultReviewUrl = googlePlaceId 
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : `https://search.google.com/local/writereview?placeid=ChIJN1t_t_xZwokR0_example_dhanus_gold`;

  const [reviewUrl, setReviewUrl] = useState(defaultReviewUrl);
  const [customBusinessName, setCustomBusinessName] = useState(businessName);
  const [headline, setHeadline] = useState('Loved Your Workout?');
  const [subheadline, setSubheadline] = useState('Scan with your phone camera to leave us a 5-star Google review!');
  const [incentiveText, setIncentiveText] = useState('Show your review at front desk to claim 1 Free Protein Shake!');
  const [template, setTemplate] = useState<TemplateType>('standee');
  const [theme, setTheme] = useState<ColorTheme>('gold');
  
  // QR Output state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // Generate QR Code
  useEffect(() => {
    if (!isOpen) return;
    
    const generateQr = async () => {
      try {
        let fgColor = '#000000';
        let bgColor = '#FFFFFF';

        if (theme === 'dark') {
          fgColor = '#F59E0B'; // Amber Gold
          bgColor = '#111827'; // Dark Slate
        } else if (theme === 'gold') {
          fgColor = '#000000';
          bgColor = '#FFFFFF';
        } else if (theme === 'emerald') {
          fgColor = '#065F46';
          bgColor = '#FFFFFF';
        }

        const url = await QRCode.toDataURL(reviewUrl, {
          width: 600,
          margin: 2,
          color: {
            dark: fgColor,
            light: bgColor
          },
          errorCorrectionLevel: 'H'
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('QR code generation error:', err);
      }
    };

    generateQr();
  }, [reviewUrl, theme, isOpen]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `${customBusinessName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-google-review-qr.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  // Color theme class mappings
  const themeStyles = {
    gold: {
      bg: 'bg-gradient-to-b from-amber-50 to-amber-100/60 text-slate-900 border-amber-300',
      badge: 'bg-amber-400 text-black font-black',
      starColor: 'text-amber-500 fill-amber-500',
      accentBorder: 'border-amber-400',
      footerBg: 'bg-amber-400/20 text-slate-900 border-amber-300'
    },
    dark: {
      bg: 'bg-slate-950 text-white border-amber-500/30',
      badge: 'bg-amber-400 text-black font-black',
      starColor: 'text-amber-400 fill-amber-400',
      accentBorder: 'border-amber-500/50',
      footerBg: 'bg-slate-900 text-amber-300 border-amber-500/20'
    },
    monochrome: {
      bg: 'bg-white text-slate-900 border-slate-300',
      badge: 'bg-slate-900 text-white font-black',
      starColor: 'text-slate-900 fill-slate-900',
      accentBorder: 'border-slate-900',
      footerBg: 'bg-slate-100 text-slate-900 border-slate-300'
    },
    emerald: {
      bg: 'bg-emerald-50/90 text-emerald-950 border-emerald-300',
      badge: 'bg-emerald-600 text-white font-black',
      starColor: 'text-amber-500 fill-amber-500',
      accentBorder: 'border-emerald-400',
      footerBg: 'bg-emerald-100 text-emerald-900 border-emerald-200'
    }
  }[theme];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      {/* Print-specific style block */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-poster, #printable-qr-poster * {
            visibility: visible !important;
          }
          #printable-qr-poster {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 2.5rem !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            z-index: 99999 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
          }
        }
      `}</style>

      <div className="bg-card border border-border rounded-3xl max-w-4xl w-full shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="p-6 border-b border-border flex items-center justify-between gap-4 bg-card-nested">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">Printable Google Review QR Code</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary/20 text-primary border border-primary/30">
                  Ready to Print
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Generate high-resolution printable table standees, flyers, or cards for your front desk.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-black font-extrabold text-xs shadow-lg shadow-primary/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              Print Flyer / Standee
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted hover:text-white hover:bg-background transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* Controls Sidebar */}
          <div className="lg:col-span-5 p-6 border-r border-border space-y-6 bg-card">
            {/* Direct Link Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                <span>Google Review Direct Link</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-bold"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied Link' : 'Copy Link'}
                </button>
              </label>
              <input
                type="text"
                value={reviewUrl}
                onChange={(e) => setReviewUrl(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=..."
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
              />
              <p className="text-[11px] text-muted leading-snug">
                Points directly to your Google review submission prompt.
              </p>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Select Print Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'standee', label: 'Counter Standee (4" x 6")', desc: 'Table display' },
                  { id: 'poster', label: 'Full Poster (8.5" x 11")', desc: 'Wall flyer' },
                  { id: 'card', label: 'Review Card (3.5" x 2")', desc: 'Handout card' },
                  { id: 'badge', label: 'Minimal Sticker', desc: 'Door / Glass' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id as TemplateType)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      template === t.id
                        ? 'bg-primary/10 border-primary text-white font-bold shadow-md'
                        : 'bg-background border-border text-muted hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">{t.label}</div>
                    <div className="text-[10px] text-muted">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Theme Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                Design & Color Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'gold', label: 'Luxury Gold', color: 'bg-amber-400' },
                  { id: 'dark', label: 'Dark Onyx', color: 'bg-slate-900 border border-amber-400' },
                  { id: 'monochrome', label: 'Classic Black/White', color: 'bg-slate-800' },
                  { id: 'emerald', label: 'Fresh Emerald', color: 'bg-emerald-600' },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setTheme(th.id as ColorTheme)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                      theme === th.id
                        ? 'bg-card-nested border-primary text-white font-bold ring-2 ring-primary/20'
                        : 'bg-background border-border text-muted hover:text-white'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${th.color}`} />
                    <span className="text-xs">{th.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Customization Fields */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Text Customization</span>
                <button
                  type="button"
                  onClick={() => setIsCustomizing(!isCustomizing)}
                  className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  {isCustomizing ? 'Hide Custom Text' : 'Edit Text'}
                </button>
              </div>

              {isCustomizing && (
                <div className="space-y-3 animate-fadeIn">
                  <div>
                    <label className="block text-[11px] text-muted mb-1 font-semibold">Business Name</label>
                    <input
                      type="text"
                      value={customBusinessName}
                      onChange={(e) => setCustomBusinessName(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted mb-1 font-semibold">Headline</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted mb-1 font-semibold">Instructions Subtitle</label>
                    <input
                      type="text"
                      value={subheadline}
                      onChange={(e) => setSubheadline(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted mb-1 font-semibold">Incentive / Footer Offer</label>
                    <input
                      type="text"
                      value={incentiveText}
                      onChange={(e) => setIncentiveText(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-border flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-background hover:bg-card-nested text-white text-xs font-bold transition-all"
              >
                <Download className="w-4 h-4 text-primary" />
                Download Raw QR PNG
              </button>
            </div>
          </div>

          {/* Live Printable Preview Area */}
          <div className="lg:col-span-7 p-6 bg-background/80 flex items-center justify-center min-h-[480px]">
            {/* Printable Frame Target */}
            <div
              id="printable-qr-poster"
              ref={printAreaRef}
              className={`w-full max-w-md p-8 rounded-3xl border-2 shadow-2xl transition-all text-center flex flex-col items-center justify-between space-y-6 ${themeStyles.bg} ${themeStyles.accentBorder}`}
            >
              {/* Header Logo / Badge */}
              <div className="space-y-3 w-full flex flex-col items-center">
                <div className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest ${themeStyles.badge} flex items-center gap-1.5 shadow-sm`}>
                  <Building className="w-3.5 h-3.5" />
                  <span>{customBusinessName}</span>
                </div>

                {/* 5-Star Icons */}
                <div className="flex items-center gap-1 justify-center pt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-5 h-5 ${themeStyles.starColor}`} />
                  ))}
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight leading-tight">
                  {headline}
                </h2>

                <p className="text-xs opacity-80 max-w-xs mx-auto leading-relaxed font-medium">
                  {subheadline}
                </p>
              </div>

              {/* QR Image Box */}
              <div className="bg-white p-4 rounded-2xl border-4 border-amber-400 shadow-xl relative my-2">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Google Review QR Code"
                    className="w-52 h-52 object-contain mx-auto rounded-lg"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                    Generating QR...
                  </div>
                )}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider border border-amber-400">
                  Google Review
                </div>
              </div>

              {/* Step by step scan guide */}
              <div className="w-full space-y-3 pt-2">
                <div className="flex items-center justify-center gap-4 text-[11px] font-bold opacity-90">
                  <span className="flex items-center gap-1">1️⃣ Open Camera</span>
                  <span>➔</span>
                  <span className="flex items-center gap-1">2️⃣ Point at QR</span>
                  <span>➔</span>
                  <span className="flex items-center gap-1">3️⃣ Tap Link</span>
                </div>

                {incentiveText && (
                  <div className={`p-3 rounded-xl border text-xs font-bold leading-tight ${themeStyles.footerBg}`}>
                    🎁 {incentiveText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
