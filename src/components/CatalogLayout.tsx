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
    <div className="showxating-shell min-h-screen bg-[#0a0a0f]">
      {/* Top Navigation - fixed */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <TopNavBar onSysClick={() => setShowSysPanel(true)} />

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
      </div>

      {/* SYS Panel */}
      <SysPanel isOpen={showSysPanel} onClose={() => setShowSysPanel(false)} />

      {/* Main Content - scrollable area with top and bottom padding for fixed bars */}
      <main className="pt-24 pb-32">
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
