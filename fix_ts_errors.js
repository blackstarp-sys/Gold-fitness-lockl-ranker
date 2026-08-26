import fs from 'fs';

// 1. migrate.ts
let migrateContent = fs.readFileSync('src/db/migrate.ts', 'utf8');
migrateContent = migrateContent.replace('import { db, pool }', 'import { db }');
fs.writeFileSync('src/db/migrate.ts', migrateContent);

// 2. AIImageGen.tsx
let aiImageContent = fs.readFileSync('src/pages/AIImageGen.tsx', 'utf8');
aiImageContent = aiImageContent.replace("import { Image, Loader2, AlertCircle } from 'lucide-react';", "import { Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';");
fs.writeFileSync('src/pages/AIImageGen.tsx', aiImageContent);

// 3. Settings.tsx
let settingsContent = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
settingsContent = settingsContent.replace("import { Settings, Loader2, AlertCircle } from 'lucide-react';", "import { Settings as SettingsIcon, Loader2, AlertCircle } from 'lucide-react';");
settingsContent = settingsContent.replace(/<Settings /g, "<SettingsIcon ");
fs.writeFileSync('src/pages/Settings.tsx', settingsContent);
