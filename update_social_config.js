import fs from 'fs';

let content = fs.readFileSync('src/pages/SocialConfig.tsx', 'utf8');

// Replace standard fetch with apiFetch
content = content.replace(/import \{ auth \} from '\.\.\/lib\/firebase\.ts';\n?/, "import { apiFetch } from '../lib/api.ts';\n");

// Replace auth token fetching
content = content.replace(/const token = await auth\.currentUser\?\.getIdToken\(\);/g, '');
content = content.replace(/const res = await fetch\('\/api\/(.*?)', \{(.*?)\}\);/gs, "const data = await apiFetch('/api/$1', {$2});");
content = content.replace(/headers: \{\s*'Content-Type': 'application\/json',\s*'Authorization': `Bearer \$\{token\}`\s*\}/g, 'headers: { "Content-Type": "application/json" }');
content = content.replace(/headers: \{\s*'Authorization': `Bearer \$\{token\}`\s*\}/g, '{}');

content = content.replace(/if \(res\.ok\) \{\s*setAccounts\(await res\.json\(\)\);\s*\}/g, 'if (data) setAccounts(data);');
content = content.replace(/if \(res\.ok\) \{[\s\S]*?fetchAccounts\(\);[\s\S]*?\}/g, 'if (data) fetchAccounts();');

// Styling adjustments
content = content.replace(/text-slate-900/g, 'text-gray-100');
content = content.replace(/text-slate-500/g, 'text-gray-400');
content = content.replace(/bg-white/g, 'bg-[#111827]/80 backdrop-blur-md');
content = content.replace(/border-slate-200/g, 'border-white/10');
content = content.replace(/bg-slate-50/g, 'bg-black/50');
content = content.replace(/text-emerald-600/g, 'text-green-500');
content = content.replace(/text-rose-600/g, 'text-red-400');
content = content.replace(/hover:bg-rose-50/g, 'hover:bg-red-400/10');
content = content.replace(/hover:border-rose-200/g, 'hover:border-red-400/20');
content = content.replace(/bg-indigo-50/g, 'bg-amber-500/10');
content = content.replace(/text-indigo-700/g, 'text-amber-500');
content = content.replace(/hover:bg-indigo-100/g, 'hover:bg-amber-500/20');
content = content.replace(/text-slate-800/g, 'text-gray-300');
content = content.replace(/bg-slate-100/g, 'bg-white/10');
content = content.replace(/bg-blue-50/g, 'bg-blue-500/10');
content = content.replace(/bg-pink-50/g, 'bg-pink-500/10');
content = content.replace(/text-indigo-600/g, 'text-green-500');

fs.writeFileSync('src/pages/SocialConfig.tsx', content);
