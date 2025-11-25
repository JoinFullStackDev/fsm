/**
 * Custom hook for managing focus in modals and forms
 * Provides utilities for focus trapping, returning focus, and focusing on error fields
 */

import { useEffect, useRef, RefObject } from 'react';

/**
 * Store the element that had focus before opening a modal
 * Return focus to that element when closing
 */
export function useReturnFocus(open: boolean) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else {
      // Return focus when modal closes
      if (previousActiveElement.current) {
        // Use setTimeout to ensure the modal is fully closed
        setTimeout(() => {
          if (previousActiveElement.current && document.contains(previousActiveElement.current)) {
            previousActiveElement.current.focus();
          }
          previousActiveElement.current = null;
        }, 100);
      }
    }
  }, [open]);
}

/**
 * Focus on the first error field in a form
 * @param errorFields - Object mapping field names to error messages
 * @param fieldRefs - Object mapping field names to refs
 * @param shouldFocus - Optional flag to control when to focus (default: true). Set to false to prevent focusing while user is typing.
 */
export function useFocusOnError(
  errorFields: Record<string, string | undefined>,
  fieldRefs: Record<string, RefObject<HTMLElement>>,
  shouldFocus: boolean = true
) {
  useEffect(() => {
    // Don't focus if flag is false or if user is currently typing in an input field
    if (!shouldFocus) {
      return;
    }

    // Check if user is currently typing in an input field
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.getAttribute('contenteditable') === 'true'
    );

    // Don't interrupt user if they're typing
    if (isTyping) {
      return;
    }

    // Find the first field with an error
    const firstErrorField = Object.keys(errorFields).find(
      (key) => errorFields[key] && fieldRefs[key]?.current
    );

    if (firstErrorField && fieldRefs[firstErrorField]?.current) {
      // Focus on the first error field
      setTimeout(() => {
        // Double-check that user isn't typing before focusing
        const currentActiveElement = document.activeElement;
        const stillTyping = currentActiveElement && (
          currentActiveElement.tagName === 'INPUT' ||
          currentActiveElement.tagName === 'TEXTAREA' ||
          currentActiveElement.getAttribute('contenteditable') === 'true'
        );

        if (!stillTyping && fieldRefs[firstErrorField]?.current) {
          fieldRefs[firstErrorField]?.current?.focus();
          // Scroll into view if needed
          fieldRefs[firstErrorField]?.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);
    }
  }, [errorFields, fieldRefs, shouldFocus]);
}

/**
 * Announce dynamic content changes to screen readers
 */
export function useAnnounceChanges(message: string, condition: boolean = true) {
  useEffect(() => {
    if (condition && message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      announcement.textContent = message;

      document.body.appendChild(announcement);

      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);

      return () => {
        if (document.body.contains(announcement)) {
          document.body.removeChild(announcement);
        }
      };
    }
  }, [message, condition]);
}

