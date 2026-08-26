import fs from 'fs';
let content = fs.readFileSync('src/pages/Posts.tsx', 'utf8');

if (!content.includes('const [error, setError]')) {
  content = content.replace(
    'const [isScheduling, setIsScheduling] = useState(false);',
    'const [isScheduling, setIsScheduling] = useState(false);\n  const [error, setError] = useState<string | null>(null);'
  );

  // Error UI
  content = content.replace(
    '</div>\n      </div>\n\n      <div className="grid',
    `</div>\n      </div>\n\n      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between mb-6">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">Dismiss</button>
        </div>
      )}\n\n      <div className="grid`
  );

  // Catch in fetch
  content = content.replace(
    /\} catch \(e\) \{\n\s*console\.error\(e\);\n\s*\}/g,
    "} catch (e: any) {\n      setError(e.message || 'Action failed');\n    }"
  );

  // Catch in generateAICaption
  content = content.replace(
    /      if \(data && data\.caption\) \{\n\s*setSummary\(data\.caption\);\n\s*\}\n\s*\} finally \{/g,
    "      if (data && data.caption) {\n        setSummary(data.caption);\n      }\n    } catch (e: any) {\n      setError(e.message || 'Failed to generate');\n    } finally {"
  );

  // Catch in handleSchedule
  content = content.replace(
    /      if \(data\) \{\n\s*setSummary\(''\);\n\s*setImageUrl\(''\);\n\s*setSelectedPlatforms\(\[\]\);\n\s*fetchData\(\);\n\s*\}\n\s*\} finally \{/g,
    "      if (data) {\n        setSummary('');\n        setImageUrl('');\n        setSelectedPlatforms([]);\n        fetchData();\n      }\n    } catch (e: any) {\n      setError(e.message || 'Failed to schedule');\n    } finally {"
  );

  fs.writeFileSync('src/pages/Posts.tsx', content);
}
