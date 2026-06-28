import { useState, useEffect, useRef, useCallback } from 'react';

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  fetchSuggestions,
  placeholder = 'Search...',
  displayKey = 'label',
  subKey,
  id,
  disabled = false,
  autoFocus = false,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [open, setOpen]               = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const debounceRef  = useRef(null);
  const abortRef     = useRef(null);
  const wrapperRef   = useRef(null);
  const inputRef     = useRef(null);
  const listRef      = useRef(null);   // ref to dropdown ul for scroll

  /* ── Position dropdown below the input (fixed, bypasses overflow) ── */
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 260),
        zIndex: 9999,
      });
    }
  }, []);

  /* ── Close on outside click / scroll ───────────────────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
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
    if (!val || val.length < 1) {
      setSuggestions([]);
      setOpen(false);
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
        setSuggestions(results || []);
        setHighlighted(-1);
      } catch {
        // aborted / network error — silently ignore
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [fetchSuggestions, updateDropdownPosition]);

  // Clear suggestions and close if value is cleared externally
  useEffect(() => {
    if (!value) {
      setSuggestions([]);
      setOpen(false);
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
    // Move focus to next focusable sibling after selection
    setTimeout(() => {
      const focusables = Array.from(
        document.querySelectorAll(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
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
      if (!open && suggestions.length > 0) {
        updateDropdownPosition();
        setOpen(true);
      }
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      if (open && highlighted >= 0) {
        e.preventDefault();
        handleSelect(suggestions[highlighted]);
      } else if (open && suggestions.length === 1) {
        // Auto-select when only one result
        e.preventDefault();
        handleSelect(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setHighlighted(-1);
    } else if (e.key === 'Tab') {
      // If dropdown is open and item is highlighted, select it on Tab
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
          if (suggestions.length > 0) {
            updateDropdownPosition();
            setOpen(true);
          }
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
              No results — try different keywords
            </div>
          )}
          {!loading && suggestions.map((item, idx) => (
            <div
              key={idx}
              id={`ac-item-${id}-${idx}`}
              role="option"
              aria-selected={highlighted === idx}
              className={`autocomplete-item${highlighted === idx ? ' highlighted' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before selection
                handleSelect(item);
              }}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <div className="autocomplete-item-main">{item[displayKey]}</div>
              {subKey && item[subKey] && (
                <div className="autocomplete-item-sub">{item[subKey]}</div>
              )}
              {highlighted === idx && (
                <div style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
                  Enter ↵
                </div>
              )}
            </div>
          ))}
          {!loading && suggestions.length > 0 && (
            <div style={{
              padding: '5px 12px', fontSize: 10, color: '#9ca3af',
              borderTop: '1px solid var(--border-light)',
              background: 'var(--bg-tertiary)',
            }}>
              ↑↓ navigate &nbsp;·&nbsp; Enter select &nbsp;·&nbsp; Tab auto-select &nbsp;·&nbsp; Esc close
            </div>
          )}
        </div>
      )}
    </div>
  );
}
