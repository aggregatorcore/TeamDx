/**
 * Task Deduplication Configuration
 * 
 * Controls how duplicate tasks are detected and handled
 */
export const taskDeduplicationConfig = {
  /**
   * Deduplication mode:
   * - "strict": Skip duplicates (don't create)
   * - "merge": Merge similar tasks
   * - "update": Update existing task with new info
   */
  mode: "strict" as "strict" | "merge" | "update",
  
  /**
   * Time windows for duplicate detection (in hours)
   */
  exactMatchWindowHours: 24,      // Level 1: Exact match window
  similarTaskWindowHours: 48,      // Level 2: Similar task window
  tagBasedWindowHours: 24,         // Level 3: Tag-based window
  
  /**
   * Similarity threshold for Level 2 detection (0-1)
   * Tasks with similarity > this threshold are considered duplicates
   */
  similarityThreshold: 0.8, // 80% similarity
};
