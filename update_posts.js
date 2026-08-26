const fs = require('fs');

let content = fs.readFileSync('src/pages/Posts.tsx', 'utf8');

// Replace standard fetch with apiFetch
content = content.replace(/import \{ apiFetch \} from '\.\.\/lib\/api\.ts';\n?/, '');
content = content.replace(/import React/, "import { apiFetch } from '../lib/api.ts';\nimport React");

// Replace auth token fetching
content = content.replace(/const token = await auth\.currentUser\?\.getIdToken\(\);/g, '');
content = content.replace(/const res = await fetch\('\/api\/(.*?)', \{(.*?)\}\);/gs, "const data = await apiFetch('/api/$1', {$2});");
content = content.replace(/headers: \{[\s\S]*?'Authorization': `Bearer \$\{token\}`[\s\S]*?\}/g, 'headers: { "Content-Type": "application/json" }');
content = content.replace(/if \(res\.ok\) \{[\s\S]*?const data = await res\.json\(\);/g, 'if (data) {');
content = content.replace(/const data = await res\.json\(\);/g, '');

// Styling adjustments
content = content.replace(/text-slate-900/g, 'text-gray-100');
content = content.replace(/text-slate-500/g, 'text-gray-400');
content = content.replace(/text-slate-700/g, 'text-gray-300');
content = content.replace(/bg-white/g, 'bg-[#111827]/80');
content = content.replace(/border-slate-200/g, 'border-white/10');
content = content.replace(/bg-slate-50/g, 'bg-black/50');
content = content.replace(/text-indigo-900/g, 'text-amber-500');
content = content.replace(/bg-indigo-50/g, 'bg-amber-500/10');
content = content.replace(/border-indigo-100/g, 'border-amber-500/20');
content = content.replace(/bg-indigo-600/g, 'bg-amber-500');
content = content.replace(/hover:bg-indigo-700/g, 'hover:bg-amber-600');
content = content.replace(/bg-blue-600/g, 'bg-green-500 text-black');
content = content.replace(/hover:bg-blue-700/g, 'hover:bg-green-600 text-black');
content = content.replace(/text-slate-800/g, 'text-gray-300');
content = content.replace(/bg-slate-100/g, 'bg-white/10');

fs.writeFileSync('src/pages/Posts.tsx', content);
