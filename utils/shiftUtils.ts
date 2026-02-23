/**
 * Shift Utility Functions
 * Handles shift-aware scheduling and validation for TELECALLER role
 */

export interface ShiftConfig {
  shiftStart: string; // "09:30" format
  shiftEnd: string;   // "17:30" format
}

/**
 * Check if a datetime is within the shift hours
 */
export function isWithinShift(
  datetime: Date,
  shiftStart: string,
  shiftEnd: string
): boolean {
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const [endHour, endMin] = shiftEnd.split(':').map(Number);
  
  const shiftStartTime = new Date(datetime);
  shiftStartTime.setHours(startHour, startMin, 0, 0);
  
  const shiftEndTime = new Date(datetime);
  shiftEndTime.setHours(endHour, endMin, 0, 0);
  
  const time = datetime.getTime();
  const startTime = shiftStartTime.getTime();
  const endTime = shiftEndTime.getTime();
  
  return time >= startTime && time <= endTime;
}

/**
 * Get the next shift start time (tomorrow's shift start)
 */
export function getNextShiftStart(
  datetime: Date,
  shiftStart: string
): Date {
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const nextShift = new Date(datetime);
  nextShift.setDate(nextShift.getDate() + 1);
  nextShift.setHours(startHour, startMin, 0, 0);
  return nextShift;
}

/**
 * Get today's shift start time
 */
export function getTodayShiftStart(
  datetime: Date,
  shiftStart: string
): Date {
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const todayShift = new Date(datetime);
  todayShift.setHours(startHour, startMin, 0, 0);
  return todayShift;
}

/**
 * Snap a datetime to be within shift bounds
 * Rule A: callbackAt cannot be outside shift
 * Rule B: if shift ending soon (e.g. 5 mins left), snap to next shift start
 */
export function snapToShift(
  datetime: Date,
  shiftStart: string,
  shiftEnd: string,
  bufferMinutes: number = 5 // Default 5 minutes buffer before shift end
): Date {
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const [endHour, endMin] = shiftEnd.split(':').map(Number);
  
  const shiftStartTime = new Date(datetime);
  shiftStartTime.setHours(startHour, startMin, 0, 0);
  
  const shiftEndTime = new Date(datetime);
  shiftEndTime.setHours(endHour, endMin, 0, 0);
  
  const bufferTime = new Date(shiftEndTime);
  bufferTime.setMinutes(bufferTime.getMinutes() - bufferMinutes);
  
  // If before shift start, snap to today's shift start
  if (datetime < shiftStartTime) {
    return shiftStartTime;
  }
  
  // If after shift end, snap to next day's shift start
  if (datetime > shiftEndTime) {
    return getNextShiftStart(datetime, shiftStart);
  }
  
  // If within buffer period (shift ending soon), snap to next shift start
  if (datetime >= bufferTime && datetime <= shiftEndTime) {
    return getNextShiftStart(datetime, shiftStart);
  }
  
  // If within shift and not in buffer period, return as-is
  return datetime;
}

/**
 * Calculate callback time with shift awareness
 * Handles: +60m, next_day, +48h formats
 */
export function calculateShiftAwareCallback(
  baseTime: Date,
  timing: string,
  shiftStart: string,
  shiftEnd: string
): Date {
  let callbackTime = new Date(baseTime);
  
  // Parse timing string: +60m / 60m, +48h / 48h, next_day
  const relativeMatch = timing.match(/^\+?(\d+)([mhd])$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    if (unit === "m") {
      callbackTime = new Date(callbackTime.getTime() + value * 60 * 1000);
    } else if (unit === "h") {
      callbackTime = new Date(callbackTime.getTime() + value * 60 * 60 * 1000);
    } else if (unit === "d") {
      callbackTime = new Date(callbackTime.getTime() + value * 24 * 60 * 60 * 1000);
    }
  } else if (timing === "next_day" || timing === "next_day_shift_start") {
    // Next day at shift start
    callbackTime = getNextShiftStart(baseTime, shiftStart);
  } else if (timing === "+48h_shift_start") {
    // 48 hours from now, but at shift start
    const futureDate = new Date(baseTime);
    futureDate.setDate(futureDate.getDate() + 2);
    callbackTime = getTodayShiftStart(futureDate, shiftStart);
  }
  
  // Snap to shift bounds
  return snapToShift(callbackTime, shiftStart, shiftEnd);
}

/**
 * Get default telecaller shift (fallback)
 */
export function getDefaultTelecallerShift(): ShiftConfig {
  return {
    shiftStart: "09:30",
    shiftEnd: "17:30",
  };
}
