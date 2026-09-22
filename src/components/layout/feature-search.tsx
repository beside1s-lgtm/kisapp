'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_FEATURES, getFeatureIcon, type FeatureItem } from '@/lib/featureRegistry';

const MAX_RESULTS = 8;

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** 낮을수록 더 강한 일치. 매칭되지 않으면 null. */
function scoreMatch(item: FeatureItem, q: string): number | null {
  const label = normalize(item.label);
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (label.includes(q)) return 2;
  if (item.keywords?.some((k) => normalize(k).includes(q))) return 3;
  if (item.description && normalize(item.description).includes(q)) return 4;
  if (normalize(item.categoryLabel).includes(q)) return 5;
  return null;
}

/**
 * 사이드바 "빠른 도구" 영역의 기능 검색창.
 * featureRegistry.ts의 ALL_FEATURES를 검색 대상으로 삼으므로,
 * 새 기능을 그 목록에 추가하기만 하면 이 검색에도 자동으로 잡힌다.
 */
export function SidebarFeatureSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return ALL_FEATURES.filter((f) => f.searchable !== false)
      .map((item) => ({ item, score: scoreMatch(item, q) }))
      .filter((r): r is { item: FeatureItem; score: number } => r.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.item);
  }, [query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = React.useCallback(
    (item: FeatureItem) => {
      if (item.actionType === 'calendar-sync') {
        window.dispatchEvent(new CustomEvent('openAcademicCalendarSyncModal'));
      } else if (item.href) {
        router.push(item.href);
      }
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    },
    [router]
  );

  const handleClear = () => {
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  return (
    <PopoverPrimitive.Root open={open && results.length > 0} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(e.target.value.trim().length > 0);
            }}
            onFocus={() => {
              if (query.trim().length > 0) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="기능 검색 (예: 봉사)"
            aria-label="기능 검색"
            className="w-full h-8 pl-8 pr-7 rounded-xl border border-input bg-background text-xs font-medium placeholder:text-muted-foreground/70 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="검색어 지우기"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className="z-[70] max-h-80 overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-lg p-1.5 scrollbar-thin"
        >
          {results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground text-center">
              &lsquo;{query}&rsquo;에 대한 검색 결과가 없습니다.
            </p>
          ) : (
            <div className="space-y-0.5">
              {results.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors',
                    idx === activeIndex
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-700 hover:bg-muted/70'
                  )}
                >
                  <div
                    className={cn(
                      'p-1 rounded-lg shrink-0 transition-colors',
                      idx === activeIndex
                        ? 'bg-primary text-white'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {getFeatureIcon(item.iconName, 'w-3.5 h-3.5')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.categoryLabel}
                      {item.description ? ` · ${item.description}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
