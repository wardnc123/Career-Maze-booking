'use client';

import { useState, useEffect, FormEvent } from 'react';
import type { Program } from '@/models/types';

type PageState =
  | { kind: 'loading' }
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

export default function CancelBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const [bookingId, setBookingId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const [brandColor, setBrandColor] = useState('#1a1a2e');

  // Resolve params and try to fetch program brand color
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { bookingId: id } = await params;
      if (cancelled) return;
      setBookingId(id);

      // Try to look up the booking's program brand color
      try {
        const [eventsRes, programsRes] = await Promise.all([
          fetch('/api/admin/setup', { cache: 'no-store' }),
          fetch('/api/programs', { cache: 'no-store' }),
        ]);
        if (eventsRes.ok && programsRes.ok) {
          const events = await eventsRes.json();
          const programs: Program[] = await programsRes.json();
          // We don't have direct booking→program mapping from client side without email,
          // but we can try to infer from the bookingId if we have a lookup.
          // For now, if there's only one program, use its brand color.
          // The brand color will be refined once the user enters email and we can look up bookings.
          if (programs.length === 1) {
            if (!cancelled) setBrandColor(programs[0].brandColor);
          }
          // Store programs and events for later lookup
          if (!cancelled) {
            (window as unknown as Record<string, unknown>).__cancelPagePrograms = programs;
            (window as unknown as Record<string, unknown>).__cancelPageEvents = events;
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setPageState({ kind: 'form' });
    }
    init();
    return () => { cancelled = true; };
  }, [params]);

  // Try to resolve brand color when email is provided
  async function resolveBrandColor() {
    try {
      const res = await fetch(`/api/bookings/lookup?email=${encodeURIComponent(email.trim())}`, { cache: 'no-store' });
      if (!res.ok) return;
      const bookings = await res.json();
      const booking = bookings.find((b: { id: string }) => b.id === bookingId);
      if (!booking?.eventTitle) return;

      const events = (window as unknown as Record<string, unknown>).__cancelPageEvents as Array<{ id: string; title: string; programId: string }> | undefined;
      const programs = (window as unknown as Record<string, unknown>).__cancelPagePrograms as Program[] | undefined;
      if (!events || !programs) return;

      const event = events.find((e) => e.title === booking.eventTitle);
      if (!event) return;
      const program = programs.find((p) => p.id === event.programId);
      if (program) setBrandColor(program.brandColor);
    } catch { /* ignore */ }
  }

  function validate(): boolean {
    if (!email.trim()) { setEmailError('Email is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailError('Please enter a valid email address'); return false; }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Try to resolve brand color before submitting
    await resolveBrandColor();

    setPageState({ kind: 'submitting' });

    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) { setPageState({ kind: 'cancelled' }); return; }
      if (res.status === 403) { setPageState({ kind: 'error', message: 'You are not authorized to cancel this booking' }); return; }
      if (res.status === 404) { setPageState({ kind: 'error', message: 'Booking not found' }); return; }
      if (res.status === 409) { setPageState({ kind: 'error', message: 'This booking has already been cancelled' }); return; }

      const data = await res.json().catch(() => null);
      setPageState({ kind: 'error', message: data?.error || 'Something went wrong. Please try again.' });
    } catch {
      setPageState({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  if (pageState.kind === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Loading…</p>
      </main>
    );
  }

  // --- Cancelled confirmation ---
  if (pageState.kind === 'cancelled') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-green-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Cancelled</h1>
          <p className="text-gray-600 mb-4">Your booking has been successfully cancelled. A confirmation email will be sent shortly.</p>
          <a href="/" className="inline-block px-4 py-2 text-white rounded hover:opacity-90 transition-colors" style={{ backgroundColor: brandColor }}>← Back to sessions</a>
        </div>
      </main>
    );
  }

  // --- Error ---
  if (pageState.kind === 'error') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-3" aria-hidden="true">✕</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Cancellation Failed</h1>
          <p className="text-red-600 mb-4">{pageState.message}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setPageState({ kind: 'form' })} className="px-4 py-2 text-white rounded hover:opacity-90 transition-colors" style={{ backgroundColor: brandColor }}>Try Again</button>
            <a href="/" className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Back to sessions</a>
          </div>
        </div>
      </main>
    );
  }

  // --- Form / Submitting ---
  const isSubmitting = pageState.kind === 'submitting';

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <a href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">← Back to sessions</a>

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="h-1 -mt-6 -mx-6 mb-4 rounded-t-lg" style={{ backgroundColor: brandColor }} />
          <h1 className="text-xl font-bold text-gray-900">Cancel Booking</h1>
          <p className="text-gray-600 text-sm">Enter the email address you used when booking to verify your identity.</p>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailError ? 'border-red-400' : 'border-gray-300'}`}
              aria-invalid={!!emailError} aria-describedby={emailError ? 'email-error' : undefined} />
            {emailError && <p id="email-error" className="text-red-500 text-xs mt-1">{emailError}</p>}
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full py-2 px-4 text-white rounded font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#dc2626' }}>
            {isSubmitting ? 'Cancelling…' : 'Cancel Booking'}
          </button>
        </form>
      </div>
    </main>
  );
}
