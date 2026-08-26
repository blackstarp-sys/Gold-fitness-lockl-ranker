import fs from 'fs';
let content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');

content = content.replace(
  /\} catch \(error\) \{\n\s*console\.error\(error\);\n\s*\}/g,
  "} catch (error: any) {\n      setError(error.message || 'Action failed');\n    }"
);

fs.writeFileSync('src/pages/Reviews.tsx', content);
