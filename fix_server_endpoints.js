import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// Find the newly appended block
const newEndpoints = `// Missing Endpoints added for generated pages`;
const splitIndex = content.lastIndexOf(newEndpoints);

if (splitIndex !== -1) {
  const extracted = content.substring(splitIndex);
  content = content.substring(0, splitIndex); // remove it from bottom
  
  // Find where to insert it (before cron.schedule)
  const insertIndex = content.indexOf("// CRON JOB: Every 5 minutes");
  if (insertIndex !== -1) {
    content = content.substring(0, insertIndex) + extracted + "\n\n" + content.substring(insertIndex);
    fs.writeFileSync('server.ts', content);
  }
}
