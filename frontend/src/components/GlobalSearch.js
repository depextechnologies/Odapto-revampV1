import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { apiGet } from '../utils/api';
import { Search, Layout, CreditCard, Grid3X3, X } from 'lucide-react';

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const searchApi = useCallback(async (q) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const response = await apiGet(`/search?q=${encodeURIComponent(q)}`);
      if (response.ok) {
        setResults(await response.json());
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchApi(val), 300);
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setOpen(false);
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigateTo = (path) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(path);
  };

  const hasResults = results && (results.boards?.length > 0 || results.cards?.length > 0 || results.templates?.length > 0);
  const hasQuery = query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md" data-testid="global-search">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={() => hasQuery && setOpen(true)}
          placeholder="Search boards, cards..."
          className="pl-9 pr-16 h-9 bg-muted/50 border-muted focus:bg-background"
          data-testid="global-search-input"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button onClick={handleClear} className="p-1 hover:bg-muted rounded" data-testid="search-clear-btn">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </div>
      </div>

      {/* Dropdown Results */}
      {open && hasQuery && (
        <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto" data-testid="search-results-dropdown">
          {loading && (
            <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
          )}

          {!loading && !hasResults && (
            <div className="p-4 text-center text-sm text-muted-foreground">No results found</div>
          )}

          {!loading && hasResults && (
            <div className="py-1">
              {results.boards?.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Boards</div>
                  {results.boards.map((board) => (
                    <button
                      key={board.board_id}
                      onClick={() => navigateTo(`/board/${board.board_id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                      data-testid={`search-result-board-${board.board_id}`}
                    >
                      <Layout className="w-4 h-4 text-odapto-teal flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{board.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.cards?.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t border-border">Cards</div>
                  {results.cards.map((card) => (
                    <button
                      key={card.card_id}
                      onClick={() => navigateTo(`/board/${card.board_id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                      data-testid={`search-result-card-${card.card_id}`}
                    >
                      <CreditCard className="w-4 h-4 text-odapto-orange flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{card.title}</p>
                        {card.description && (
                          <p className="text-xs text-muted-foreground truncate">{card.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.templates?.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t border-border">Templates</div>
                  {results.templates.map((tmpl) => (
                    <button
                      key={tmpl.board_id}
                      onClick={() => navigateTo('/templates')}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                      data-testid={`search-result-template-${tmpl.board_id}`}
                    >
                      <Grid3X3 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tmpl.template_name || tmpl.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
