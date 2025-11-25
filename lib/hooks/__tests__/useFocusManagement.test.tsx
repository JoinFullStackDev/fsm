import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  useReturnFocus,
  useFocusOnError,
  useAnnounceChanges,
} from '../useFocusManagement';

describe('useFocusManagement', () => {
  describe('useReturnFocus', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should store the active element when opening', () => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      document.body.appendChild(button);
      button.focus();

      const { rerender } = renderHook(
        ({ open }) => useReturnFocus(open),
        { initialProps: { open: false } }
      );

      expect(document.activeElement).toBe(button);

      rerender({ open: true });

      expect(document.activeElement).toBe(button);
    });

    it('should return focus when closing', () => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      document.body.appendChild(button);
      button.focus();

      jest.useFakeTimers();

      const { rerender } = renderHook(
        ({ open }) => useReturnFocus(open),
        { initialProps: { open: false } }
      );

      rerender({ open: true });

      // Change focus while modal is open (this shouldn't affect what gets restored)
      const otherButton = document.createElement('button');
      otherButton.textContent = 'Other Button';
      document.body.appendChild(otherButton);
      otherButton.focus();

      rerender({ open: false });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Check that focus returned to the original button (the one that had focus when opening)
      expect(document.activeElement).toBe(button);
      expect(document.activeElement?.textContent).toBe('Test Button');

      jest.useRealTimers();
    });

    it('should not return focus if element is removed from DOM', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();

      jest.useFakeTimers();

      const { rerender } = renderHook(
        ({ open }) => useReturnFocus(open),
        { initialProps: { open: false } }
      );

      rerender({ open: true });

      document.body.removeChild(button);

      rerender({ open: false });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should not throw error
      expect(document.activeElement).not.toBe(button);

      jest.useRealTimers();
    });
  });

  describe('useFocusOnError', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should focus on first error field', () => {
      const input1 = document.createElement('input');
      input1.id = 'field1';
      document.body.appendChild(input1);

      const input2 = document.createElement('input');
      input2.id = 'field2';
      document.body.appendChild(input2);

      jest.useFakeTimers();

      const fieldRefs = {
        field1: { current: input1 },
        field2: { current: input2 },
      };

      const { rerender } = renderHook(
        ({ errorFields }) => useFocusOnError(errorFields, fieldRefs),
        {
          initialProps: {
            errorFields: {},
          },
        }
      );

      rerender({
        errorFields: {
          field1: 'Error message',
          field2: 'Another error',
        },
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(document.activeElement).toBe(input1);

      jest.useRealTimers();
    });

    it('should not focus if no error fields', () => {
      const input = document.createElement('input');
      input.id = 'field1';
      document.body.appendChild(input);

      const fieldRefs = {
        field1: { current: input },
      };

      renderHook(() =>
        useFocusOnError({}, fieldRefs)
      );

      expect(document.activeElement).not.toBe(input);
    });

    it('should handle missing refs gracefully', () => {
      const fieldRefs = {
        field1: { current: null },
      };

      renderHook(() =>
        useFocusOnError({ field1: 'Error' }, fieldRefs)
      );

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('useAnnounceChanges', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should create aria-live announcement', () => {
      renderHook(() => useAnnounceChanges('Test announcement', true));

      const announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBeGreaterThan(0);
      expect(announcements[0].textContent).toBe('Test announcement');
      expect(announcements[0].getAttribute('aria-live')).toBe('polite');
    });

    it('should not create announcement when condition is false', () => {
      renderHook(() => useAnnounceChanges('Test announcement', false));

      const announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBe(0);
    });

    it('should remove announcement after timeout', () => {
      jest.useFakeTimers();

      renderHook(() => useAnnounceChanges('Test announcement', true));

      let announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBeGreaterThan(0);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBe(0);

      jest.useRealTimers();
    });

    it('should cleanup on unmount', () => {
      jest.useFakeTimers();

      const { unmount } = renderHook(() =>
        useAnnounceChanges('Test announcement', true)
      );

      let announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBeGreaterThan(0);

      unmount();

      announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBe(0);

      jest.useRealTimers();
    });
  });
});

