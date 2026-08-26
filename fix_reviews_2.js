import fs from 'fs';
let content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');

// Add error state
if (!content.includes('const [error, setError]')) {
  content = content.replace(
    'const [isSyncing, setIsSyncing] = useState(false);',
    'const [isSyncing, setIsSyncing] = useState(false);\n  const [error, setError] = useState<string | null>(null);'
  );
  
  // Add error display UI after Header block
  content = content.replace(
    '</header>\n\n      {/* Tabs & Controls */}',
    `</header>\n\n      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between mb-6">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">Dismiss</button>
        </div>
      )}\n\n      {/* Tabs & Controls */}`
  );
  
  // Replace the catch blocks
  content = content.replace(
    /\} catch \(e\) \{\n\s*console\.error\(e\);\n\s*\}/g,
    "} catch (error: any) {\n      setError(error.message || 'Action failed');\n    }"
  );
  
  content = content.replace(
    /\} catch \(error\) \{\n\s*console\.error\('.*?', error\);\n\s*alert\('.*?'\);\n\s*\}/g,
    "} catch (error: any) {\n      setError(error.message || 'Action failed');\n    }"
  );
  
  content = content.replace(
    /\} catch \(error\) \{\n\s*console\.error\(error\);\n\s*\}/g,
    "} catch (error: any) {\n      setError(error.message || 'Action failed');\n    }"
  );
  
  fs.writeFileSync('src/pages/Reviews.tsx', content);
}
