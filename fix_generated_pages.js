import fs from 'fs';

const pages = [
  'KeywordTracker.tsx', 'Competitors.tsx', 'CitationManager.tsx', 'Campaigns.tsx',
  'WebsiteAudit.tsx', 'ReviewAutomation.tsx', 'ReplyTemplates.tsx', 'AIContentStudio.tsx',
  'AIImageGen.tsx', 'WhatsApp.tsx', 'Settings.tsx'
];

for (const file of pages) {
  let content = fs.readFileSync('src/pages/' + file, 'utf8');
  
  if (!content.includes('showActionError')) {
    // Add state for action error
    content = content.replace(
      'const [error, setError] = useState<string | null>(null);',
      'const [error, setError] = useState<string | null>(null);\n  const [showActionError, setShowActionError] = useState(false);'
    );
    
    // Update Add New button
    content = content.replace(
      '<button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition-colors font-medium">',
      '<button onClick={() => setShowActionError(true)} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition-colors font-medium">'
    );
    
    // Update Edit button
    content = content.replace(
      '<button className="text-indigo-400 hover:text-indigo-300 font-medium">Edit</button>',
      '<button onClick={() => setShowActionError(true)} className="text-indigo-400 hover:text-indigo-300 font-medium">Edit</button>'
    );
    
    // Add the error message UI right after the header block
    content = content.replace(
      '</div>\n\n      {loading ? (',
      `</div>\n\n      {showActionError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <p className="text-sm text-amber-400">Configuration Required: This action requires additional setup.</p>
          </div>
          <button onClick={() => setShowActionError(false)} className="text-amber-500 hover:text-amber-400">
            Dismiss
          </button>
        </div>
      )}\n\n      {loading ? (`
    );
    
    fs.writeFileSync('src/pages/' + file, content);
  }
}
