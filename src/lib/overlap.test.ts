import { describe, it, expect } from 'vitest';
import { hasOverlap } from './overlap';

describe('hasOverlap', () => {
  const d = (iso: string) => new Date(iso);

  it('returns false when there are no existing bookings', () => {
    expect(hasOverlap([], d('2026-08-03T09:00:00Z'))).toBe(false);
  });

  it('detects overlap when new session starts during an existing 3-hour window', () => {
    const existing = [{ startTime: d('2026-08-03T09:00:00Z') }]; // window 09:00–12:00
    // New session at 11:00 (within 09:00–12:00 window)
    expect(hasOverlap(existing, d('2026-08-03T11:00:00Z'))).toBe(true);
  });

  it('detects overlap when existing session starts during the new 3-hour window', () => {
    const existing = [{ startTime: d('2026-08-03T11:00:00Z') }]; // window 11:00–14:00
    // New session at 09:00 (window 09:00–12:00), existing starts at 11:00 which is < 12:00
    expect(hasOverlap(existing, d('2026-08-03T09:00:00Z'))).toBe(true);
  });

  it('returns false when sessions are exactly 3 hours apart (no overlap)', () => {
    const existing = [{ startTime: d('2026-08-03T09:00:00Z') }]; // window 09:00–12:00
    // New session at 12:00 — newStart (12:00) is NOT < existingEnd (12:00)
    expect(hasOverlap(existing, d('2026-08-03T12:00:00Z'))).toBe(false);
  });

  it('returns false when sessions are more than 3 hours apart', () => {
    const existing = [{ startTime: d('2026-08-03T09:00:00Z') }]; // window 09:00–12:00
    expect(hasOverlap(existing, d('2026-08-03T14:00:00Z'))).toBe(false);
  });

  it('detects overlap with any one of multiple existing bookings', () => {
    const existing = [
      { startTime: d('2026-08-03T09:00:00Z') }, // 09:00–12:00
      { startTime: d('2026-08-03T14:00:00Z') }, // 14:00–17:00
    ];
    // Overlaps with second booking
    expect(hasOverlap(existing, d('2026-08-03T15:00:00Z'))).toBe(true);
  });

  it('returns false when new session does not overlap any existing booking', () => {
    const existing = [
      { startTime: d('2026-08-03T09:00:00Z') }, // 09:00–12:00
      { startTime: d('2026-08-03T14:00:00Z') }, // 14:00–17:00
    ];
    // 12:00–15:00 does not overlap 09:00–12:00 (boundary) but DOES overlap 14:00–17:00
    // Use 12:00 which is exactly at boundary of first, check against second: 12:00 < 17:00 && 14:00 < 15:00 → true
    // Let's pick a truly non-overlapping time
    expect(hasOverlap(existing, d('2026-08-04T09:00:00Z'))).toBe(false);
  });

  it('detects overlap when windows overlap by just 1 millisecond', () => {
    const existing = [{ startTime: d('2026-08-03T09:00:00Z') }]; // 09:00–12:00
    // New session at 11:59:59.999 — newStart < existingEnd (12:00) → true
    // existingStart (09:00) < newEnd (14:59:59.999) → true
    expect(hasOverlap(existing, d('2026-08-03T11:59:59.999Z'))).toBe(true);
  });

  it('handles identical start times as overlapping', () => {
    const existing = [{ startTime: d('2026-08-03T09:00:00Z') }];
    expect(hasOverlap(existing, d('2026-08-03T09:00:00Z'))).toBe(true);
  });

  it('handles new session starting before existing session within 3-hour window', () => {
    const existing = [{ startTime: d('2026-08-03T10:00:00Z') }]; // 10:00–13:00
    // New at 08:00 (window 08:00–11:00): 08:00 < 13:00 && 10:00 < 11:00 → true
    expect(hasOverlap(existing, d('2026-08-03T08:00:00Z'))).toBe(true);
  });
});
