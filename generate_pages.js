import fs from 'fs';

const pages = {
  'KeywordTracker.tsx': { title: 'Keyword Tracker', desc: 'Track your local search rankings for target keywords.', icon: 'Search', endpoint: '/api/seo/keywords' },
  'Competitors.tsx': { title: 'Competitor Analysis', desc: 'Monitor your competitors rankings and ratings.', icon: 'Crosshair', endpoint: '/api/competitors' },
  'CitationManager.tsx': { title: 'Citation Manager', desc: 'Manage your business listings across local directories.', icon: 'List', endpoint: '/api/citations' },
  'Campaigns.tsx': { title: 'Campaigns', desc: 'Send automated review request campaigns.', icon: 'Target', endpoint: '/api/campaigns' },
  'WebsiteAudit.tsx': { title: 'Website SEO Audit', desc: 'Analyze your website for local SEO optimizations.', icon: 'ShieldAlert', endpoint: '/api/seo/audit' },
  'ReviewAutomation.tsx': { title: 'Review Automation', desc: 'Configure automatic AI replies for new reviews.', icon: 'MessageSquare', endpoint: '/api/settings/review-automation' },
  'ReplyTemplates.tsx': { title: 'Reply Templates', desc: 'Manage canned responses for quick manual replies.', icon: 'MessageSquare', endpoint: '/api/settings/templates' },
  'AIContentStudio.tsx': { title: 'AI Content Studio', desc: 'Generate SEO-optimized content for your Google Business Profile.', icon: 'Bot', endpoint: '/api/ai/studio' },
  'AIImageGen.tsx': { title: 'AI Image Generator', desc: 'Create professional photos for your business profile.', icon: 'Image as ImageIcon', endpoint: '/api/ai/images' },
  'WhatsApp.tsx': { title: 'WhatsApp Integration', desc: 'Connect WhatsApp Business to manage messages and send requests.', icon: 'Send', endpoint: '/api/settings/whatsapp' },
  'Settings.tsx': { title: 'Settings', desc: 'Manage your account and billing preferences.', icon: 'Settings', endpoint: '/api/settings/profile' },
};

for (const [filename, info] of Object.entries(pages)) {
  const content = `import React, { useEffect, useState } from 'react';
import { ${info.icon.split(' as ')[0]}, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';

export default function ${filename.replace('.tsx', '')}() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('${info.endpoint}');
      if (res) setData(Array.isArray(res) ? res : [res]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <${info.icon.split(' as ').pop()} className="w-6 h-6 text-indigo-400" />
          ${info.title}
        </h1>
        <p className="text-gray-400 mt-1">${info.desc}</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-red-400 mb-1">Configuration Required</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={fetchData} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Retry
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <${info.icon.split(' as ').pop()} className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">No data available</h3>
          <p className="text-gray-500 mt-1">Get started by adding your first record.</p>
          <button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition-colors font-medium">
            Add New
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-slate-800/50 text-xs uppercase font-medium text-gray-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((item, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">{item.name || item.keyword || item.businessName || item.platform || 'Item ' + (i+1)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-indigo-400 hover:text-indigo-300 font-medium">Edit</button>
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
`;
  fs.writeFileSync('src/pages/' + filename, content);
}

