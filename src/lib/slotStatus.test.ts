import { describe, it, expect } from 'vitest';
import { deriveSlotStatus } from './slotStatus';

describe('deriveSlotStatus', () => {
  it('returns Available when bookingCount is 0', () => {
    expect(deriveSlotStatus(0, 0)).toBe('Available');
    expect(deriveSlotStatus(0, 5)).toBe('Available');
  });

  it('returns Limited when bookingCount is 1', () => {
    expect(deriveSlotStatus(1, 0)).toBe('Limited');
  });

  it('returns Limited when bookingCount is 2', () => {
    expect(deriveSlotStatus(2, 0)).toBe('Limited');
  });

  it('returns Full when bookingCount is 3 and no waitlist', () => {
    expect(deriveSlotStatus(3, 0)).toBe('Full');
  });

  it('returns Waitlisted when bookingCount is 3 and waitlist exists', () => {
    expect(deriveSlotStatus(3, 1)).toBe('Waitlisted');
    expect(deriveSlotStatus(3, 10)).toBe('Waitlisted');
  });
});
