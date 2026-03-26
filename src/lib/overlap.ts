/**
 * 3-Hour Overlap Detection
 *
 * Each booking occupies a 3-hour window from its start time.
 * Two windows overlap if: newStartTime < existingEnd && existingStartTime < newEnd
 *
 * Validates: Requirements 1.5, 3.5
 */

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export function hasOverlap(
  existingBookings: { startTime: Date }[],
  newStartTime: Date
): boolean {
  const newEnd = new Date(newStartTime.getTime() + THREE_HOURS_MS);
  return existingBookings.some((b) => {
    const existingEnd = new Date(b.startTime.getTime() + THREE_HOURS_MS);
    return newStartTime < existingEnd && b.startTime < newEnd;
  });
}
