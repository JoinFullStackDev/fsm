/**
 * Request deduplication utility
 * Prevents duplicate requests by tracking in-flight requests and returning the same promise
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

  /**
   * Execute a request with deduplication
   * If a request with the same key is already in flight, returns the existing promise
   */
  async execute<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already in flight
    const existing = this.pendingRequests.get(key);
    if (existing) {
      // Check if request is stale (shouldn't happen, but safety check)
      const age = Date.now() - existing.timestamp;
      if (age < this.REQUEST_TIMEOUT_MS) {
        return existing.promise;
      } else {
        // Stale request - remove it
        this.pendingRequests.delete(key);
      }
    }

    // Create new request
    const promise = requestFn()
      .then((result) => {
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Check if a request is pending
   */
  isPending(key: string): boolean {
    const existing = this.pendingRequests.get(key);
    if (!existing) {
      return false;
    }

    const age = Date.now() - existing.timestamp;
    if (age >= this.REQUEST_TIMEOUT_MS) {
      this.pendingRequests.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear pending request (useful for testing or manual cleanup)
   */
  clear(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clearAll(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { pendingCount: number; keys: string[] } {
    // Clean up stale requests
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp >= this.REQUEST_TIMEOUT_MS) {
        this.pendingRequests.delete(key);
      }
    }

    return {
      pendingCount: this.pendingRequests.size,
      keys: Array.from(this.pendingRequests.keys()),
    };
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Generate a cache key for request deduplication
 */
export function generateRequestKey(
  endpoint: string,
  params?: Record<string, any>
): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint;
  }

  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${endpoint}:${sortedParams}`;
}

