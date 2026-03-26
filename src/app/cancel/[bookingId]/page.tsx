'use client';

import { useState, FormEvent } from 'react';

type PageState =
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
  const [pageState, setPageState] = useState<PageState>({ kind: 'form' });
  const [resolved, setResolved] = useState(false);

  // Resolve params once
  if (!resolved) {
    params.then(({ bookingId: id }) => {
      setBookingId(id);
      setResolved(true);
    });
  }

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPageState({ kind: 'submitting' });

    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        setPageState({ kind: 'cancelled' });
        return;
      }

      if (res.status === 403) {
        setPageState({ kind: 'error', message: 'You are not authorized to cancel this booking' });
        return;
      }

      if (res.status === 404) {
        setPageState({ kind: 'error', message: 'Booking not found' });
        return;
      }

      if (res.status === 409) {
        setPageState({ kind: 'error', message: 'This booking has already been cancelled' });
        return;
      }

      const data = await res.json().catch(() => null);
      setPageState({
        kind: 'error',
        message: data?.error || 'Something went wrong. Please try again.',
      });
    } catch {
      setPageState({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  // --- Cancelled confirmation ---
  if (pageState.kind === 'cancelled') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-green-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Cancelled</h1>
          <p className="text-gray-600 mb-4">
            Your booking has been successfully cancelled. A confirmation email will be sent shortly.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            ← Back to sessions
          </a>
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
            <button
              onClick={() => setPageState({ kind: 'form' })}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Back to sessions
            </a>
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
        <a href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← Back to sessions
        </a>

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Cancel Booking</h1>
          <p className="text-gray-600 text-sm">
            Enter the email address you used when booking to verify your identity.
          </p>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                emailError ? 'border-red-400' : 'border-gray-300'
              }`}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && (
              <p id="email-error" className="text-red-500 text-xs mt-1">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Cancelling…' : 'Cancel Booking'}
          </button>
        </form>
      </div>
    </main>
  );
}
