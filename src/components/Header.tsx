export default function Header() {
  return (
    <header className='h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8'>
      <div className='flex items-center gap-4'>
        <div className='flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200'>
          <span className='text-sm font-medium'>Cafe Monsoon - Mumbai</span>
          <div className='w-4 h-4 opacity-40 border-b-2 border-r-2 border-slate-900 rotate-45 mb-1'></div>
        </div>
      </div>
      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-2 text-sm text-slate-500 border-r border-slate-200 pr-6'>
          <span className='font-medium text-slate-900'>Language:</span>
          <div className='bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs flex items-center gap-1 cursor-pointer'>
            <span>हिन्दी (Hindi)</span>
            <div className='w-2 h-2 border-b border-r border-slate-400 rotate-45 mb-0.5'></div>
          </div>
        </div>
        <div className='flex gap-3'>
          <button className='bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors'>
            + New Post
          </button>
        </div>
      </div>
    </header>
  );
}
