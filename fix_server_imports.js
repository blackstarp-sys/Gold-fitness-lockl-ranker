import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /import \{ scheduledPosts, reviews, socialAccounts, businessLocations, seoKeywords, keywordRankHistory, competitors, citationSources, campaigns, campaignLogs \} from '\.\/src\/db\/schema\.ts';/,
  "import { scheduledPosts, reviews, socialAccounts, businessLocations, seoKeywords, keywordRankHistory, competitors, citationSources, campaigns, campaignLogs, users, seoAudits } from './src/db/schema.ts';"
);

fs.writeFileSync('server.ts', content);
