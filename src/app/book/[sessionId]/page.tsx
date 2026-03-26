'use client';

import { useEffect, useState, FormEvent } from 'react';
import type { Session, Booking, WaitlistEntry } from '@/models/types';

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'confirmed'; booking: Booking }
  | { kind: 'waitlisted'; entry: WaitlistEntry }
  | { kind: 'session-full'; message: string }
  | { kind: 'error'; message: string };

export default function BookSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const [sessionId, setSessionId] = useState<string>('');
  const [session, setSession] = useState<Session | null>(null);
  const [eventLocation, setEventLocation] = useState<string>('');
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [pf, setPf] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Resolve params and fetch session
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { sessionId: id } = await params;
      if (cancelled) return;
      setSessionId(id);

      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) {
          if (!cancelled) setPageState({ kind: 'not-found' });
          return;
        }
        const data: Session = await res.json();
        if (!cancelled) {
          setSession(data);
          setPageState({ kind: 'form' });
          // Fetch event location
          fetch('/api/admin/setup')
            .then((r) => r.json())
            .then((events) => {
              const event = events.find((e: { id: string }) => e.id === data.eventId);
              if (event?.location) setEventLocation(event.location);
            })
            .catch(() => {});
        }
      } catch {
        if (!cancelled) setPageState({ kind: 'not-found' });
      }
    }
    init();
    return () => { cancelled = true; };
  }, [params]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    if (!role.trim()) errors.role = 'Role is required';
    if (!pf.trim()) errors.pf = 'PF is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPageState({ kind: 'submitting' });
    setFieldErrors({});

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: name.trim(),
          email: email.trim(),
          role: role.trim(),
          pf: pf.trim(),
        }),
      });

      const data = await res.json();

      if (res.status === 201 && data.status === 'confirmed') {
        setPageState({ kind: 'confirmed', booking: data.booking });
        return;
      }

      if (res.status === 200 && data.status === 'waitlisted') {
        setPageState({ kind: 'waitlisted', entry: data.waitlistEntry });
        return;
      }

      if (res.status === 409) {
        const errorMsg: string = data.error || 'Booking conflict';
        if (errorMsg.toLowerCase().includes('full')) {
          setPageState({ kind: 'session-full', message: errorMsg });
        } else {
          setPageState({ kind: 'error', message: errorMsg });
        }
        return;
      }

      if (res.status === 400) {
        setPageState({ kind: 'form' });
        if (data.missingFields) {
          const errors: Record<string, string> = {};
          for (const f of data.missingFields as string[]) {
            errors[f] = `${f.charAt(0).toUpperCase() + f.slice(1)} is required`;
          }
          setFieldErrors(errors);
        } else {
          setFieldErrors({ _form: data.error || 'Invalid input' });
        }
        return;
      }

      setPageState({ kind: 'error', message: data.error || 'Something went wrong' });
    } catch {
      setPageState({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  async function handleJoinWaitlist() {
    setPageState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: name.trim(),
          email: email.trim(),
          role: role.trim(),
          pf: pf.trim(),
        }),
      });
      const data = await res.json();
      if (data.status === 'waitlisted') {
        setPageState({ kind: 'waitlisted', entry: data.waitlistEntry });
      } else {
        setPageState({ kind: 'error', message: data.error || 'Could not join waitlist' });
      }
    } catch {
      setPageState({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  // --- Loading ---
  if (pageState.kind === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Loading session…</p>
      </main>
    );
  }

  // --- Not found ---
  if (pageState.kind === 'not-found') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">Session not found</p>
          <a href="/" className="text-blue-600 hover:underline">← Back to sessions</a>
        </div>
      </main>
    );
  }

  // --- Confirmed ---
  if (pageState.kind === 'confirmed' && session) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-green-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Confirmed</h1>
          <p className="text-gray-600 mb-4">Your session has been booked successfully.</p>
          <div className="bg-gray-50 rounded p-4 mb-4 text-left space-y-1">
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium text-gray-900">{formatDate(session.sessionDate)}</p>
            <p className="text-sm text-gray-500 mt-2">Time</p>
            <p className="font-medium text-gray-900">{formatTime(session.startTime)} (Europe/London)</p>
            <p className="text-sm text-gray-500 mt-2">Reference Code</p>
            <p className="font-mono font-bold text-gray-900">{pageState.booking.referenceCode}</p>
            {eventLocation && (
              <>
                <p className="text-sm text-gray-500 mt-2">Location</p>
                <p className="font-medium text-gray-900">{eventLocation}</p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <a
              href={`/api/bookings/${pageState.booking.id}/calendar`}
              download
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              📅 Add to Calendar (.ics)
            </a>
            <a href="/" className="inline-block px-4 py-2 bg-[#1a1a2e] text-white rounded hover:bg-[#2a2a4e] transition-colors">
              ← Back to sessions
            </a>
          </div>
        </div>
      </main>
    );
  }

  // --- Waitlisted ---
  if (pageState.kind === 'waitlisted' && session) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-purple-600 text-4xl mb-3" aria-hidden="true">⏳</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Added to Waitlist</h1>
          <p className="text-gray-600 mb-4">
            This session is currently full. You have been added to the waitlist and will be notified if a spot opens up.
          </p>
          <div className="bg-gray-50 rounded p-4 mb-4 text-left space-y-1">
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium text-gray-900">{formatDate(session.sessionDate)}</p>
            <p className="text-sm text-gray-500 mt-2">Time</p>
            <p className="font-medium text-gray-900">{formatTime(session.startTime)} (Europe/London)</p>
          </div>
          <a href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            ← Back to sessions
          </a>
        </div>
      </main>
    );
  }

  // --- Session full (waitlist opt-in prompt) ---
  if (pageState.kind === 'session-full') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-3" aria-hidden="true">✕</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Session Full</h1>
          <p className="text-gray-600 mb-4">{pageState.message}</p>
          <p className="text-gray-600 mb-6">Would you like to join the waitlist?</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleJoinWaitlist}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Join Waitlist
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

  // --- Error ---
  if (pageState.kind === 'error') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-3" aria-hidden="true">✕</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Error</h1>
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
      <div className="max-w-lg mx-auto">
        <a href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← Back to sessions
        </a>

        {session && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h1 className="text-lg font-bold text-gray-900">Book Session</h1>
            <p className="text-gray-700 mt-1">
              {formatDate(session.sessionDate)} at {formatTime(session.startTime)} (Europe/London)
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {session.bookingCount}/3 booked · {session.slotStatus}
            </p>
          </div>
        )}

        {fieldErrors._form && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
            {fieldErrors._form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.name ? 'border-red-400' : 'border-gray-300'
              }`}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="name-error" className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.email ? 'border-red-400' : 'border-gray-300'
              }`}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <input
              id="role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.role ? 'border-red-400' : 'border-gray-300'
              }`}
              aria-invalid={!!fieldErrors.role}
              aria-describedby={fieldErrors.role ? 'role-error' : undefined}
            />
            {fieldErrors.role && (
              <p id="role-error" className="text-red-500 text-xs mt-1">{fieldErrors.role}</p>
            )}
          </div>

          <div>
            <label htmlFor="pf" className="block text-sm font-medium text-gray-700 mb-1">
              PF <span className="text-red-500">*</span>
            </label>
            <input
              id="pf"
              type="text"
              value={pf}
              onChange={(e) => setPf(e.target.value)}
              disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.pf ? 'border-red-400' : 'border-gray-300'
              }`}
              aria-invalid={!!fieldErrors.pf}
              aria-describedby={fieldErrors.pf ? 'pf-error' : undefined}
            />
            {fieldErrors.pf && (
              <p id="pf-error" className="text-red-500 text-xs mt-1">{fieldErrors.pf}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Booking…' : 'Book Session'}
          </button>
        </form>
      </div>
    </main>
  );
}
