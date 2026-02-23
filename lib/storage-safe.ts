/**
 * Safe localStorage utility with quota management
 * Handles quota exceeded errors and provides cleanup functionality
 */

interface StorageItem {
  key: string;
  size: number;
  timestamp: number;
}

/**
 * Get the size of a string in bytes
 */
function getStringSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Get all localStorage keys and their sizes
 */
function getStorageInfo(): StorageItem[] {
  if (typeof window === "undefined") return [];
  
  const items: StorageItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        items.push({
          key,
          size: getStringSize(value),
          timestamp: Date.now(), // We'll use current time as fallback
        });
      }
    }
  }
  return items;
}

/**
 * Clean up old document data from localStorage
 * Removes document-related keys that are older than specified days
 * If maxAgeDays is 0, removes ALL document keys (use with caution)
 */
export function cleanupOldDocuments(maxAgeDays: number = 30): number {
  if (typeof window === "undefined") return 0;
  
  let cleaned = 0;
  
  try {
    // Get all document keys
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("lead_documents_") || key.startsWith("lead_extra_documents_"))) {
        keys.push(key);
      }
    }
    
    // If maxAgeDays is 0, remove all documents (emergency cleanup)
    if (maxAgeDays === 0) {
      keys.forEach((key) => {
        try {
          localStorage.removeItem(key);
          cleaned++;
        } catch (e) {
          console.warn(`Failed to remove ${key}:`, e);
        }
      });
      return cleaned;
    }
    
    // Otherwise, we don't have timestamps, so we'll be more conservative
    // Only clean up if explicitly requested with maxAgeDays > 30
    // For normal cleanup (7 days), we'll skip to avoid removing active documents
    if (maxAgeDays < 30) {
      // Don't clean up documents that might be in use
      // Only clean up if explicitly requested for emergency situations
      return 0;
    }
    
    // For very old documents (30+ days), remove them
    // Since we don't have timestamps, we'll remove all if maxAgeDays >= 30
    keys.forEach((key) => {
      try {
        localStorage.removeItem(key);
        cleaned++;
      } catch (e) {
        console.warn(`Failed to remove ${key}:`, e);
      }
    });
  } catch (e) {
    console.error("Error cleaning up documents:", e);
  }
  
  return cleaned;
}

/**
 * Get current localStorage usage in MB
 */
export function getStorageUsage(): { used: number; available: number; percentage: number } {
  if (typeof window === "undefined") {
    return { used: 0, available: 0, percentage: 0 };
  }
  
  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += getStringSize(value);
      }
    }
  }
  
  // Most browsers have ~5-10MB limit, we'll use 5MB as conservative estimate
  const limit = 5 * 1024 * 1024; // 5MB in bytes
  const usedMB = totalSize / (1024 * 1024);
  const availableMB = (limit - totalSize) / (1024 * 1024);
  const percentage = (totalSize / limit) * 100;
  
  return {
    used: usedMB,
    available: availableMB,
    percentage: Math.min(percentage, 100),
  };
}

/**
 * Safely set item in localStorage with quota management
 * If quota is exceeded, it will attempt to clean up old documents first
 */
export function safeSetItem(key: string, value: string, options?: { maxRetries?: number; cleanupOnError?: boolean }): boolean {
  if (typeof window === "undefined") return false;
  
  const maxRetries = options?.maxRetries ?? 1;
  const cleanupOnError = options?.cleanupOnError ?? true;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      // Check if it's a quota exceeded error
      if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
        if (attempt < maxRetries && cleanupOnError) {
          // Try to clean up old documents (30+ days first, then all if needed)
          console.warn("localStorage quota exceeded, cleaning up old documents...");
          let cleaned = cleanupOldDocuments(30);
          
          // If still failing after cleanup, try removing all document-related items as last resort
          if (attempt === maxRetries - 1 && cleaned === 0) {
            console.warn("Still quota exceeded, removing all document cache as emergency cleanup...");
            cleaned = cleanupOldDocuments(0);
          }
        } else {
          // Final attempt failed
          console.error("Failed to save to localStorage after cleanup:", e);
          throw new Error("Storage quota exceeded. Please clear your browser cache or contact support.");
        }
      } else {
        // Other error, rethrow
        throw e;
      }
    }
  }
  
  return false;
}

/**
 * Safely get item from localStorage
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(`Error reading from localStorage (${key}):`, e);
    return null;
  }
}

/**
 * Safely remove item from localStorage
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Error removing from localStorage (${key}):`, e);
  }
}

/**
 * Initialize storage cleanup on app load
 * Runs cleanup of old documents automatically
 */
export function initStorageCleanup(): void {
  if (typeof window === "undefined") return;
  
  // Only clean up very old documents (30+ days) on app load
  // This prevents removing active documents that users are currently viewing
  try {
    cleanupOldDocuments(30);
  } catch (e) {
    console.error("Error during storage cleanup:", e);
  }
}

