import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput } from './SearchInput';
import { FilterBar } from './FilterBar';
import { useCards } from '../hooks/useCards';
import { useUrlFilters } from '../hooks/useUrlFilters';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { filteredCount, totalCount, isLoading } = useCards();

  // Sync filters with URL for shareable links
  useUrlFilters();

  return (
    <div className="min-h-screen bg-space-900 flex flex-col">
      {/* Header - minimal */}
      <header className="sticky top-0 z-40 glass border-b border-space-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">HF</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">HF4A Cards</h1>
              </div>
            </Link>

            {/* Count */}
            <div className="text-sm text-gray-400">
              {isLoading ? (
                <span>Loading...</span>
              ) : (
                <span>
                  <span className="text-white font-medium">{filteredCount}</span>
                  {filteredCount !== totalCount && (
                    <span> of {totalCount}</span>
                  )} cards
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - scrollable area above bottom bar */}
      <main className="flex-1 overflow-auto pb-32">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Bottom Bar - pinned search and filters */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-space-700">
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
