import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// fix parseInt(req.params.id) issues
content = content.replace(/const reviewIdStr = req\.params\.id;/g, "const reviewIdStr = req.params.id as string;");
// Also find any direct parseInt(req.params.id)
content = content.replace(/parseInt\(req\.params\.id\)/g, "parseInt(req.params.id as string)");

// remove enforceOwnership
content = content.replace(/const enforceOwnership.*?\n/, "");

fs.writeFileSync('server.ts', content);
