'use client';

import { useEffect } from 'react';

/**
 * Configuration for a keyboard shortcut
 */
export interface KeyboardShortcut {
  /** The key to press (e.g., 's', 'Enter', 'Escape') */
  key: string;
  /** Whether Ctrl key must be pressed */
  ctrl?: boolean;
  /** Whether Shift key must be pressed */
  shift?: boolean;
  /** Whether Alt key must be pressed */
  alt?: boolean;
  /** Whether Meta/Cmd key must be pressed (Mac) */
  meta?: boolean;
  /** Function to call when shortcut is triggered */
  action: () => void;
  /** Optional description for documentation */
  description?: string;
}

/**
 * Custom hook to register keyboard shortcuts
 * 
 * Automatically handles modifier key matching and prevents shortcuts from firing
 * when typing in input fields (unless Ctrl/Cmd is pressed, allowing shortcuts like Ctrl+S).
 * 
 * @param shortcuts - Array of keyboard shortcut configurations
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     key: 's',
 *     ctrl: true,
 *     action: () => handleSave(),
 *     description: 'Save document'
 *   },
 *   {
 *     key: 'Escape',
 *     action: () => handleClose(),
 *     description: 'Close dialog'
 *   }
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        // Check modifier keys - if specified, must match; if not specified, must not be pressed
        const ctrlMatch = shortcut.ctrl !== undefined ? (shortcut.ctrl === event.ctrlKey) : !event.ctrlKey;
        const shiftMatch = shortcut.shift !== undefined ? (shortcut.shift === event.shiftKey) : !event.shiftKey;
        const altMatch = shortcut.alt !== undefined ? (shortcut.alt === event.altKey) : !event.altKey;
        const metaMatch = shortcut.meta !== undefined ? (shortcut.meta === event.metaKey) : !event.metaKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        // Check if we're in an input/textarea/contenteditable
        const isInputFocused =
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          (event.target instanceof HTMLElement && event.target.isContentEditable);

        // Allow shortcuts even in inputs for certain keys (like Ctrl+S, Cmd+S)
        const allowInInput = shortcut.ctrl || shortcut.meta;

        if (
          ctrlMatch &&
          shiftMatch &&
          altMatch &&
          metaMatch &&
          keyMatch &&
          (allowInInput || !isInputFocused)
        ) {
          event.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

