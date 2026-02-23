/**
 * Frontend token storage utilities
 * Tab-specific storage using sessionStorage
 */

/**
 * Tab-specific storage utility
 * Uses sessionStorage which is automatically isolated per browser tab
 * This allows different tabs to have different user sessions
 */
export const tabStorage = {
  /**
   * Set item in tab-specific storage (sessionStorage)
   * Each tab has its own sessionStorage, so data is automatically isolated
   */
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(key, value);
  },

  /**
   * Get item from tab-specific storage (sessionStorage)
   */
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(key);
  },

  /**
   * Remove item from tab-specific storage (sessionStorage)
   */
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(key);
  },

  /**
   * Clear all tab-specific storage
   */
  clear(): void {
    if (typeof window === "undefined") return;
    sessionStorage.clear();
  },
};








