import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput } from './SearchInput';
import { FilterBar } from './FilterBar';
import { useCards } from '../hooks/useCards';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { filteredCount, totalCount, isLoading } = useCards();

  return (
    <div className="min-h-screen bg-space-900">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-space-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">HF</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white">HF4A Cards</h1>
                <p className="text-xs text-gray-400">High Frontier 4 All</p>
              </div>
            </Link>

            {/* Search */}
            <div className="flex-1 max-w-xl">
              <SearchInput />
            </div>

            {/* Count */}
            <div className="text-sm text-gray-400 shrink-0 hidden md:block">
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

        {/* Filter Bar */}
        <FilterBar />
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-space-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>
            Card images from{' '}
            <a
              href="https://boardgamegeek.com/boardgame/281655/high-frontier-4-all"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              High Frontier 4 All
            </a>{' '}
            by ION Game Design
          </p>
        </div>
      </footer>
    </div>
  );
}
