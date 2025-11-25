import { renderHook, waitFor, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value updates', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 299ms (just before delay)
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // Fast-forward remaining 1ms
    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should use custom delay values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    rerender({ value: 'updated', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should cancel previous timeout on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: 'initial' },
      }
    );

    // Rapidly change values
    rerender({ value: 'value1' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'value2' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'value3' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Should still be initial value
    expect(result.current).toBe('initial');

    // Complete the delay
    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current).toBe('value3');
    });
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useDebounce('test', 300));
    
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should handle number values', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: 0 },
      }
    );

    rerender({ value: 100 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current).toBe(100);
    });
  });

  it('should handle object values', async () => {
    const initialObj = { key: 'value1' };
    const updatedObj = { key: 'value2' };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: initialObj },
      }
    );

    rerender({ value: updatedObj });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current).toEqual(updatedObj);
    });
  });
});

