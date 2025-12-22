import { Link, useLocation } from 'react-router-dom';

type ActiveView = 'scan' | 'catalog';

interface TopNavBarProps {
  onSysClick?: () => void;
}

export function TopNavBar({ onSysClick }: TopNavBarProps) {
  const location = useLocation();

  // Determine active view from path
  const getActiveView = (): ActiveView => {
    if (location.pathname.startsWith('/showxating')) return 'scan';
    return 'catalog';
  };

  const activeView = getActiveView();

  // Button styles
  const buttonStyle = {
    fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
    color: '#a08040',
  };
  const buttonClass = "px-3 py-1.5 text-xs font-semibold tracking-wider border border-[#d4a84b]/50 hover:bg-[#d4a84b]/10 transition-colors uppercase";

  // Active title styles
  const titleStyle = {
    fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
    color: '#d4a84b',
    textShadow: '0 0 10px rgba(212, 168, 75, 0.3)',
  };

  return (
    <header className="relative flex items-center justify-between px-4 py-3 bg-[#0a0a0f] border-b border-[#d4a84b]/30">
      {/* Left: SYS button - always here */}
      <button
        onClick={onSysClick}
        className={buttonClass}
        style={buttonStyle}
      >
        SYS
      </button>

      {/* Center: Active view title - always centered */}
      <h1
        className="text-lg font-semibold tracking-wider uppercase absolute left-1/2 transform -translate-x-1/2"
        style={titleStyle}
      >
        {activeView === 'scan' ? 'SHOWXATING' : 'CATALOG'}
      </h1>

      {/* Right: Inactive view button */}
      {activeView === 'scan' ? (
        <Link to="/catalog" className={buttonClass} style={buttonStyle}>
          CAT
        </Link>
      ) : (
        <Link to="/showxating" className={buttonClass} style={buttonStyle}>
          SXT
        </Link>
      )}
    </header>
  );
}
