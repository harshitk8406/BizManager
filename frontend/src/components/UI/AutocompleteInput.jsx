import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Highlight matching letters in a label string ──────────── */
function HighlightMatch({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const lower = text.toLowerCase();
  const q     = query.toLowerCase();
  const idx   = lower.indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: '#d1fae5', color: '#065f46', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </span>
  );
}

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  fetchSuggestions,
  placeholder = 'Search...',
  displayKey  = 'label',
  subKey,
  id,
  disabled    = false,
  autoFocus   = false,
  onAddNew,          // optional: callback to open quick-add modal
  addNewLabel,       // optional: label for add button e.g. "+ New Supplier"
}) {
  const [suggestions, setSuggestions]       = useState([]);
  const [loading, setLoading]               = useState(false);
  const [open, setOpen]                     = useState(false);
  const [highlighted, setHighlighted]       = useState(-1);
  const [dropdownStyle, setDropdownStyle]   = useState({});
  const [activeQuery, setActiveQuery]       = useState(''); // query that produced current list

  const debounceRef  = useRef(null);
  const abortRef     = useRef(null);
  const wrapperRef   = useRef(null);
  const inputRef     = useRef(null);
  const listRef      = useRef(null);
  const queryRef     = useRef('');

  /* ── Position dropdown below the input (fixed, bypasses overflow) ── */
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top:      rect.bottom + 4,
        left:     rect.left,
        width:    Math.max(rect.width, 280),
        zIndex:   9999,
      });
    }
  }, []);

  /* ── Close on outside click / scroll ───────────────────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  /* ── Auto-focus on mount if requested ──────────────────────── */
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /* ── Fetch suggestions with debounce ───────────────────────── */
  const triggerSearch = useCallback((val) => {
    queryRef.current = val;

    if (!val || val.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      setActiveQuery('');
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      updateDropdownPosition();
      setOpen(true);
      try {
        const results = await fetchSuggestions(val);
        // Backend already returns prefix-first sorted results.
        // We do a final client-side sort to ensure prefix wins
        // in case of any reordering by the mapping step.
        const q = queryRef.current.toLowerCase();
        const sorted = (results || []).slice().sort((a, b) => {
          const la = (a[displayKey] || '').toLowerCase();
          const lb = (b[displayKey] || '').toLowerCase();
          const aStart = la.startsWith(q) ? 0 : 1;
          const bStart = lb.startsWith(q) ? 0 : 1;
          if (aStart !== bStart) return aStart - bStart;
          return la.localeCompare(lb);
        });
        setSuggestions(sorted);
        setActiveQuery(queryRef.current);
        setHighlighted(0); // pre-highlight first result for fast selection
      } catch {
        // aborted / network error — silently ignore
      } finally {
        setLoading(false);
      }
    }, 200); // 200ms debounce (faster than 250)
  }, [fetchSuggestions, updateDropdownPosition, displayKey]);

  // Clear suggestions and close if value is cleared externally
  useEffect(() => {
    if (!value) {
      setSuggestions([]);
      setOpen(false);
      setActiveQuery('');
    }
  }, [value]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  /* ── Scroll highlighted item into view inside the dropdown ─── */
  useEffect(() => {
    if (!listRef.current || highlighted < 0) return;
    const items = listRef.current.querySelectorAll('.autocomplete-item');
    items[highlighted]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlighted]);

  /* ── Select a suggestion ────────────────────────────────────── */
  const handleSelect = useCallback((item) => {
    onSelect(item);
    setOpen(false);
    setSuggestions([]);
    setActiveQuery('');
    setTimeout(() => {
      const focusables = Array.from(
        document.querySelectorAll(
          'input:not([disabled]):not([type="hidden"]):not([readonly]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        )
      );
      const currentIdx = focusables.indexOf(inputRef.current);
      if (currentIdx >= 0 && focusables[currentIdx + 1]) {
        focusables[currentIdx + 1].focus();
      }
    }, 50);
  }, [onSelect]);

  /* ── Keyboard handling ──────────────────────────────────────── */
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && suggestions.length > 0) { updateDropdownPosition(); setOpen(true); }
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      if (open && highlighted >= 0) {
        e.preventDefault();
        handleSelect(suggestions[highlighted]);
      } else if (open && suggestions.length === 1) {
        e.preventDefault();
        handleSelect(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setHighlighted(-1);
    } else if (e.key === 'Tab') {
      if (open && highlighted >= 0) {
        e.preventDefault();
        handleSelect(suggestions[highlighted]);
      } else if (open && suggestions.length === 1) {
        e.preventDefault();
        handleSelect(suggestions[0]);
      } else {
        setOpen(false);
      }
    }
  };

  /* ── Prefix badge: shown on items that start with query ─────── */
  const isPrefix = (item) => {
    if (!activeQuery) return false;
    return (item[displayKey] || '').toLowerCase().startsWith(activeQuery.toLowerCase());
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="form-control"
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val);
          triggerSearch(val);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) { updateDropdownPosition(); setOpen(true); }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-activedescendant={highlighted >= 0 ? `ac-item-${id}-${highlighted}` : undefined}
      />
      {open && (
        <div
          className="autocomplete-dropdown"
          style={dropdownStyle}
          ref={listRef}
          role="listbox"
        >
          {loading && (
            <div className="autocomplete-no-results">
              <span className="spinner" style={{ width: 14, height: 14 }}></span>
              &nbsp;Searching...
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <div className="autocomplete-no-results">
              No results for &ldquo;<strong>{activeQuery}</strong>&rdquo;
              {onAddNew && (
                <button
                  className="quick-add-btn"
                  style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                  onMouseDown={(e) => { e.preventDefault(); setOpen(false); onAddNew(); }}
                >
                  {addNewLabel || '+ Add New'}
                </button>
              )}
            </div>
          )}
          {!loading && suggestions.map((item, idx) => (
            <div
              key={idx}
              id={`ac-item-${id}-${idx}`}
              role="option"
              aria-selected={highlighted === idx}
              className={`autocomplete-item${highlighted === idx ? ' highlighted' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {/* Prefix badge — green dot for prefix matches */}
                {isPrefix(item) && (
                  <span title="Starts with your search" style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#16a34a', flexShrink: 0,
                  }} />
                )}
                <div className="autocomplete-item-main" style={{ flex: 1, minWidth: 0 }}>
                  <HighlightMatch text={item[displayKey]} query={activeQuery} />
                </div>
                {highlighted === idx && (
                  <div style={{ fontSize: 9, color: '#9ca3af', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Enter ↵
                  </div>
                )}
              </div>
              {subKey && item[subKey] && (
                <div className="autocomplete-item-sub">
                  <HighlightMatch text={item[subKey]} query={activeQuery} />
                </div>
              )}
            </div>
          ))}
          {!loading && suggestions.length > 0 && (
            <div style={{
              padding: '5px 12px', fontSize: 10, color: '#9ca3af',
              borderTop: '1px solid var(--border-light)',
              background: 'var(--bg-tertiary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>●</span> = starts with &nbsp;·&nbsp;
                ↑↓ navigate &nbsp;·&nbsp; Enter select &nbsp;·&nbsp; Esc close
              </span>
              {onAddNew && (
                <button
                  className="quick-add-btn"
                  style={{ margin: 0, padding: '2px 8px' }}
                  onMouseDown={(e) => { e.preventDefault(); setOpen(false); onAddNew(); }}
                >
                  {addNewLabel || '+ Add New'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
