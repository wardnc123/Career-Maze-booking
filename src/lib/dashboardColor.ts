/** Admin dashboard color indicator mapping.
 *  Green for 0–1 bookings, Yellow for 2, Red for 3.
 */
export function getIndicatorColor(bookingCount: number): { bg: string; text: string; label: string } {
  if (bookingCount <= 1) return { bg: 'bg-green-100 border-green-400', text: 'text-green-800', label: 'Green' };
  if (bookingCount === 2) return { bg: 'bg-yellow-100 border-yellow-400', text: 'text-yellow-800', label: 'Yellow' };
  return { bg: 'bg-red-100 border-red-400', text: 'text-red-800', label: 'Red' };
}
