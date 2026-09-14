import WalletButton from '../wallet/WalletButton';

const TABS = ['Bridge', 'Swap', 'Invest', 'Stocks'] as const;
export type Tab = (typeof TABS)[number] | 'Portfolio';

export default function Navbar({
  active,
  onChange,
  onHome,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  onHome?: () => void;
}) {
  return (
    <header className="bg-transparent">
      <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-[55px]">
        {/* Logo + Search */}
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 items-center gap-2 cursor-pointer" onClick={onHome}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="7" fill="#4FD1E8" fillOpacity="0.12" />
              <path d="M12 5L17 8.5V15.5L12 19L7 15.5V8.5L12 5Z" stroke="#4FD1E8" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M12 9L14.5 10.5V14L12 15.5L9.5 14V10.5L12 9Z" fill="#4FD1E8" opacity="0.3" />
            </svg>
            <span className="text-base font-bold tracking-tight text-white">Cluster</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11L14 14" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Search"
              className="w-28 bg-transparent text-sm text-white outline-none placeholder:text-text-dim"
            />
          </div>
        </div>

        {/* Connect */}
        <div className="shrink-0">
          <WalletButton onNavigatePortfolio={() => onChange('Portfolio')} />
        </div>
      </div>

      {/* Nav tabs */}
      <div className="px-4 sm:px-6 lg:px-[55px]">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => onChange(t)}
              className={`px-4 py-2.5 text-sm font-medium transition ${active === t ? 'text-white' : 'text-text-muted hover:text-white'
                }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
