const fs = require('fs');
let content = fs.readFileSync('src/pages/SocialConfig.tsx', 'utf8');

content = content.replace(/const data = await apiFetch\('\/api\/social-accounts', \{\n\s*\{\}\n\s*\}\);/g, "const data = await apiFetch('/api/social-accounts');");
content = content.replace(/const res = await fetch\(`\/api\/social-accounts\/disconnect\/\$\{id\}`\, \{\n\s*method: 'DELETE',\n\s*\{\}\n\s*\}\);/g, "const data = await apiFetch(`/api/social-accounts/disconnect/${id}`, { method: 'DELETE' });");

fs.writeFileSync('src/pages/SocialConfig.tsx', content);
