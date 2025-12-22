import { Link, useLocation } from 'react-router-dom';

type ActiveView = 'scan' | 'catalog' | 'sys';

interface TopNavBarProps {
  onSysClick?: () => void;
}

export function TopNavBar({ onSysClick }: TopNavBarProps) {
  const location = useLocation();

  // Determine active view from path
  const getActiveView = (): ActiveView => {
    if (location.pathname.startsWith('/showxating')) return 'scan';
    if (location.pathname.startsWith('/catalog') || location.pathname === '/') return 'catalog';
    return 'scan';
  };

  const activeView = getActiveView();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[#0a0a0f] border-b border-[#d4a84b]/30">
      {/* SYS button - always small, boxed */}
      <button
        onClick={onSysClick}
        className="px-3 py-1.5 text-xs font-semibold tracking-wider border border-[#d4a84b]/50 hover:bg-[#d4a84b]/10 transition-colors uppercase"
        style={{
          fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          color: '#a08040',
        }}
      >
        SYS
      </button>

      {/* Center: Active view title */}
      <div className="flex items-center gap-4">
        {activeView === 'scan' ? (
          <>
            {/* SHOWXATING - active (large, no box) */}
            <h1
              className="text-lg font-semibold tracking-wider uppercase"
              style={{
                fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
                color: '#d4a84b',
                textShadow: '0 0 10px rgba(212, 168, 75, 0.3)',
              }}
            >
              SHOWXATING
            </h1>
          </>
        ) : (
          <>
            {/* SHO - inactive (small, boxed) */}
            <Link
              to="/showxating"
              className="px-3 py-1.5 text-xs font-semibold tracking-wider border border-[#d4a84b]/50 hover:bg-[#d4a84b]/10 transition-colors uppercase"
              style={{
                fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
                color: '#a08040',
              }}
            >
              SHO
            </Link>

            {/* CATALOG - active (large, no box) */}
            <h1
              className="text-lg font-semibold tracking-wider uppercase"
              style={{
                fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
                color: '#d4a84b',
                textShadow: '0 0 10px rgba(212, 168, 75, 0.3)',
              }}
            >
              CATALOG
            </h1>
          </>
        )}
      </div>

      {/* CAT button - when scan is active, show CAT boxed */}
      {activeView === 'scan' ? (
        <Link
          to="/catalog"
          className="px-3 py-1.5 text-xs font-semibold tracking-wider border border-[#d4a84b]/50 hover:bg-[#d4a84b]/10 transition-colors uppercase"
          style={{
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
            color: '#a08040',
          }}
        >
          CAT
        </Link>
      ) : (
        // Placeholder for layout balance when catalog is active
        <div className="w-[52px]" />
      )}
    </header>
  );
}
