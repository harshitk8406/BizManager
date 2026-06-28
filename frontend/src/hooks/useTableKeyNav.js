/**
 * useTableKeyNav — arrow key row navigation + Enter to open a row
 *
 * @param {Array}    rows          the data array
 * @param {Function} onOpen        called with row when Enter pressed
 * @param {boolean}  [enabled=true]
 * @returns {{ selectedIdx, setSelectedIdx, rowProps }}
 *   rowProps(idx) returns { tabIndex, 'data-selected', onFocus, onKeyDown, style } for a <tr>
 */
import { useState, useCallback, useEffect, useRef } from 'react';

export function useTableKeyNav(rows, onOpen, enabled = true) {
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const tbodyRef = useRef(null);

  // Keep selection in bounds when rows change
  useEffect(() => {
    if (selectedIdx >= rows.length) setSelectedIdx(rows.length - 1);
  }, [rows.length]);

  // Scroll selected row into view
  useEffect(() => {
    if (!tbodyRef.current || selectedIdx < 0) return;
    const tr = tbodyRef.current.querySelectorAll('tr')[selectedIdx];
    tr?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIdx]);

  const handleKeyDown = useCallback((e) => {
    if (!enabled || rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      onOpen?.(rows[selectedIdx]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedIdx(rows.length - 1);
    }
  }, [enabled, rows, selectedIdx, onOpen]);

  // Attach keydown to the tbody element
  const getTableProps = useCallback(() => ({
    ref: tbodyRef,
    onKeyDown: handleKeyDown,
    tabIndex: 0,
  }), [handleKeyDown]);

  // Props per row
  const getRowProps = useCallback((idx) => ({
    onClick: () => setSelectedIdx(idx),
    onDoubleClick: () => { setSelectedIdx(idx); onOpen?.(rows[idx]); },
    style: selectedIdx === idx
      ? { background: 'var(--accent-dim)', outline: '2px solid var(--accent-primary)', outlineOffset: '-2px', cursor: 'pointer' }
      : { cursor: 'pointer' },
    'aria-selected': selectedIdx === idx,
  }), [selectedIdx, rows, onOpen]);

  return { selectedIdx, setSelectedIdx, getTableProps, getRowProps };
}
