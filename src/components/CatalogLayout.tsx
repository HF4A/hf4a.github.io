import { ReactNode, useState } from 'react';
import { TopNavBar } from './TopNavBar';
import { SearchInput } from './SearchInput';
import { FilterBar } from './FilterBar';
import { SysPanel } from './SysPanel';
import { useCards } from '../hooks/useCards';
import { useUrlFilters } from '../hooks/useUrlFilters';
import '../features/showxating/styles/belter-theme.css';

interface CatalogLayoutProps {
  children: ReactNode;
}

export function CatalogLayout({ children }: CatalogLayoutProps) {
  const { filteredCount, totalCount, isLoading } = useCards();
  const [showSysPanel, setShowSysPanel] = useState(false);

  // Sync filters with URL for shareable links
  useUrlFilters();

  return (
    <div className="showxating-shell min-h-screen flex flex-col">
      {/* Top Navigation */}
      <TopNavBar onSysClick={() => setShowSysPanel(true)} />

      {/* SYS Panel */}
      <SysPanel isOpen={showSysPanel} onClose={() => setShowSysPanel(false)} />

      {/* Count bar */}
      <div className="px-4 py-2 bg-[#0a0a0f] border-b border-[#d4a84b]/20">
        <div className="text-center">
          <span
            className="text-xs tracking-wider uppercase"
            style={{
              fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
              color: '#a08040',
            }}
          >
            {isLoading ? (
              'LOADING...'
            ) : (
              <>
                <span style={{ color: '#d4a84b' }}>{filteredCount}</span>
                {filteredCount !== totalCount && <span> OF {totalCount}</span>} CARDS
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Content - scrollable area above bottom bar */}
      <main className="flex-1 overflow-auto pb-32 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Bottom Bar - pinned search and filters */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-sm border-t border-[#d4a84b]/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <SearchInput />

            {/* Filters */}
            <FilterBar />
          </div>
        </div>
      </footer>
    </div>
  );
}
