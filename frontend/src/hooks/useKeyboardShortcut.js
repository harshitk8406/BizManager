/**
 * useKeyboardShortcut — register a global keyboard shortcut
 * @param {string|string[]} keys  e.g. 'alt+d', ['ctrl+enter', 'meta+enter']
 * @param {Function} callback
 * @param {Object}  [opts]
 * @param {boolean} [opts.enableInInputs=false]  fire even when focus is inside input/select/textarea
 * @param {Array}   [opts.deps=[]]
 */
import { useEffect } from 'react';

function parseKey(key) {
  const parts = key.toLowerCase().split('+');
  return {
    ctrl:  parts.includes('ctrl'),
    alt:   parts.includes('alt'),
    shift: parts.includes('shift'),
    meta:  parts.includes('meta'),
    key:   parts[parts.length - 1],
  };
}

export function useKeyboardShortcut(keys, callback, opts = {}) {
  const { enableInInputs = false, deps = [] } = opts;
  const keyList = (Array.isArray(keys) ? keys : [keys]).map(parseKey);

  useEffect(() => {
    const handler = (e) => {
      // Skip if focus is inside a text input (unless explicitly allowed)
      if (!enableInInputs) {
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      }

      for (const spec of keyList) {
        const keyMatch =
          e.key.toLowerCase() === spec.key ||
          e.code.toLowerCase() === `key${spec.key}` ||
          e.code.toLowerCase() === spec.key;

        if (
          keyMatch &&
          e.ctrlKey  === spec.ctrl &&
          e.altKey   === spec.alt &&
          e.shiftKey === spec.shift &&
          e.metaKey  === spec.meta
        ) {
          e.preventDefault();
          e.stopPropagation();
          callback(e);
          return;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * useFormShortcuts — Ctrl+Enter to submit, Escape to cancel
 */
export function useFormShortcuts({ onSave, onCancel }) {
  useKeyboardShortcut(['ctrl+enter', 'meta+enter'], () => onSave?.(), {
    enableInInputs: true, deps: [onSave],
  });
  useKeyboardShortcut('escape', () => onCancel?.(), {
    enableInInputs: false, deps: [onCancel],
  });
}
