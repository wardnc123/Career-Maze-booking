'use client';
import { useState } from 'react';
import Image from 'next/image';

interface BookingInfo { id: string; sessionId: string; name: string; email: string; referenceCode: string; status: string; sessionDate?: string; startTime?: string; eventTitle?: string; }

function formatTime(t: string) { return t.slice(0, 5); }
function formatDate(iso: string) { const d = new Date(iso + 'T00:00:00Z'); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }

export default function CancelPage() {
  const [email, setEmail] = useState('');
  const [bookings, setBookings] = useState<BookingInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function lookupBookings() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await fetch(`/api/bookings/lookup?email=${encodeURIComponent(email.trim())}`);
      if (!res.ok) { setError('Failed to look up bookings.'); setLoading(false); return; }
      const data = await res.json();
      setBookings(data);
      if (data.length === 0) setMessage('No active bookings found for this email.');
    } catch { setError('Network error.'); }
    setLoading(false);
  }

  async function cancelBooking(bookingId: string) {
    setCancelling(bookingId); setError(''); setMessage('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      if (res.ok) {
        setMessage('Booking cancelled successfully. The slot is now available for others.');
        setBookings(prev => prev ? prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b) : prev);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to cancel.');
      }
    } catch { setError('Network error.'); }
    setCancelling(null);
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
          <Image src="/career-maze-logo.jpg" alt="Career Maze" width={80} height={80} className="rounded-lg" />
          <div><h1 className="text-2xl sm:text-3xl font-bold">Cancel a Booking</h1><p className="mt-1 text-sm text-gray-300">Look up your bookings by email</p></div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Your email address</label>
          <div className="flex gap-2">
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lookupBookings(); }} placeholder="Enter the email you used to book" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={lookupBookings} disabled={loading} className="px-4 py-2 bg-[#1a1a2e] text-white rounded text-sm font-medium hover:bg-[#2a2a4e] disabled:opacity-50">{loading ? 'Looking up...' : 'Find Bookings'}</button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-green-700 text-sm">{message}</div>}

        {bookings && bookings.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Your Bookings</h2>
            {bookings.map(b => (
              <div key={b.id} className={`border rounded-lg p-4 ${b.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    {b.eventTitle && <p className="text-xs text-gray-500 mb-1">{b.eventTitle}</p>}
                    <p className="font-medium text-gray-900">{b.sessionDate ? formatDate(b.sessionDate) : 'Unknown date'} at {b.startTime ? formatTime(b.startTime) : '?'}</p>
                    <p className="text-sm text-gray-500">Ref: {b.referenceCode}</p>
                    <p className="text-xs mt-1"><span className={`inline-block px-2 py-0.5 rounded font-medium ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.status}</span></p>
                  </div>
                  {b.status === 'confirmed' && (
                    <button onClick={() => { if (confirm('Are you sure you want to cancel this booking?')) cancelBooking(b.id); }} disabled={cancelling === b.id} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">{cancelling === b.id ? 'Cancelling...' : 'Cancel'}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center"><a href="/" className="text-sm text-blue-600 hover:underline">Back to booking page</a></div>
      </div>
    </main>
  );
}
