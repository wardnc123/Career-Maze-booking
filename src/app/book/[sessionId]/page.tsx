'use client';

import { useEffect, useState, FormEvent } from 'react';
import Image from 'next/image';
import type { Session, Booking, WaitlistEntry, Program, CareerMazeEvent, CustomFormField } from '@/models/types';

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
  | { kind: 'multi-confirmed'; bookings: Booking[] }
  | { kind: 'waitlisted'; entry: WaitlistEntry }
  | { kind: 'session-full'; message: string }
  | { kind: 'error'; message: string };

export default function BookSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [event, setEvent] = useState<CareerMazeEvent | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [vpAlias, setVpAlias] = useState('');
  const [level, setLevel] = useState('');
  const [tenure, setTenure] = useState('');
  const [role, setRole] = useState('');
  const [pf, setPf] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const brandColor = program?.brandColor || '#1a1a2e';
  const programName = program?.name || 'Career Maze';
  const sessionDuration = program?.sessionDurationMinutes || 180;
  const customFormFields: CustomFormField[] = program?.customFormFields || [];

  // Check if program uses default Career Maze fields (role + pf)
  const isDefaultProgram = !program || program.id === 'default-career-maze';

  // Resolve params and fetch session → event → program
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { sessionId: rawId } = await params;
      if (cancelled) return;
      const ids = rawId.split(',');
      setSessionId(ids[0]);
      setSessionIds(ids);

      try {
        // Fetch all sessions
        const sessionResponses = await Promise.all(ids.map(id => fetch(`/api/sessions/${id}`)));
        const sessionsData: Session[] = [];
        for (const res of sessionResponses) {
          if (!res.ok) { if (!cancelled) setPageState({ kind: 'not-found' }); return; }
          sessionsData.push(await res.json());
        }
        if (cancelled) return;
        setSession(sessionsData[0]);
        setAllSessions(sessionsData);

        // Fetch events to find the event for the first session
        const eventsRes = await fetch('/api/admin/setup');
        const eventsData: CareerMazeEvent[] = await eventsRes.json();
        const eventData = eventsData.find((e) => e.id === sessionsData[0].eventId);
        if (eventData) {
          setEvent(eventData);
          // Fetch program
          const progRes = await fetch(`/api/programs/${eventData.programId}`);
          if (progRes.ok) {
            const progData: Program = await progRes.json();
            if (!cancelled) setProgram(progData);
          }
        }
        if (!cancelled) setPageState({ kind: 'form' });
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
    if (!vpAlias.trim()) errors.vpAlias = 'VP Alias is required';
    if (!level) errors.level = 'Level is required';
    if (!tenure) errors.tenure = 'Tenure is required';
    // For default program, validate role and pf
    if (isDefaultProgram) {
      if (!role.trim()) errors.role = 'Role is required';
      if (!pf.trim()) errors.pf = 'PF is required';
    }
    // Validate custom form fields
    for (const field of customFormFields) {
      if (field.required && !customFieldValues[field.name]?.trim()) {
        errors[`custom_${field.name}`] = `${field.label} is required`;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPageState({ kind: 'submitting' });
    setFieldErrors({});

    try {
      // Build custom fields object
      const customFields: Record<string, string> = {};
      for (const field of customFormFields) {
        if (customFieldValues[field.name]) {
          customFields[field.name] = customFieldValues[field.name].trim();
        }
      }

      const bookingPayload = {
        name: name.trim(),
        email: email.trim(),
        vpAlias: vpAlias.trim(),
        level,
        tenure,
        role: isDefaultProgram ? role.trim() : (customFields.role || 'N/A'),
        pf: isDefaultProgram ? pf.trim() : (customFields.pf || 'N/A'),
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      };

      // If multiple sessions, book each one
      if (sessionIds.length > 1) {
        const bookings: Booking[] = [];
        for (const sid of sessionIds) {
          const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...bookingPayload, sessionId: sid }),
          });
          const data = await res.json();
          if (res.status === 201 && data.status === 'confirmed') {
            bookings.push(data.booking);
          } else if (res.status === 409 || res.status === 400) {
            // Continue with other bookings but note the error
            continue;
          }
        }
        if (bookings.length > 0) {
          setPageState({ kind: 'multi-confirmed', bookings });
        } else {
          setPageState({ kind: 'error', message: 'Could not book any of the selected sessions.' });
        }
        return;
      }

      // Single session booking (original flow)
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookingPayload, sessionId }),
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
          role: isDefaultProgram ? role.trim() : 'N/A',
          pf: isDefaultProgram ? pf.trim() : 'N/A',
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

  const backUrl = program ? `/programs/${program.id}` : '/';

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

  function downloadCalendar(booking: { referenceCode: string; name: string; id: string }, sess: { sessionDate: string; startTime: string }) {
    const [year, month, day] = sess.sessionDate.split('-');
    const [hours, minutes] = sess.startTime.split(':');
    const dtStart = `${year}${month}${day}T${hours}${minutes}00`;
    const durationH = Math.floor(sessionDuration / 60);
    const durationM = sessionDuration % 60;
    const endMinutes = parseInt(hours) * 60 + parseInt(minutes) + sessionDuration;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');
    const dtEnd = `${year}${month}${day}T${endH}${endM}00`;
    const loc = event?.location || '';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BookingPlatform//Booking//EN',
      'BEGIN:VEVENT',
      `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
      `SUMMARY:${programName} Session - ${booking.name}`,
      `DESCRIPTION:Ref: ${booking.referenceCode}\\nProgram: ${programName}\\n\\nNeed to cancel? Visit:\\n${window.location.origin}/cancel`,
      loc ? `LOCATION:${loc}` : '',
      `UID:${booking.id}`,
      'STATUS:CONFIRMED',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${programName.toLowerCase().replace(/\s+/g, '-')}-${booking.referenceCode}.ics`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openInOutlook(booking: { referenceCode: string; name: string }, sess: { sessionDate: string; startTime: string }) {
    const [hours, minutes] = sess.startTime.split(':');
    const endMinutes = parseInt(hours) * 60 + parseInt(minutes) + sessionDuration;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');
    const startISO = `${sess.sessionDate}T${hours}:${minutes}:00`;
    const endISO = `${sess.sessionDate}T${endH}:${endM}:00`;
    const subject = encodeURIComponent(`${programName} Session - ${booking.name}`);
    const body = encodeURIComponent(`Booking reference: ${booking.referenceCode}\nProgram: ${programName}\n\nCancel: ${window.location.origin}/cancel`);
    const loc = encodeURIComponent(event?.location || '');
    window.open(`https://outlook.office.com/calendar/0/deeplink/compose?subject=${subject}&startdt=${startISO}&enddt=${endISO}&body=${body}&location=${loc}`, '_blank');
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
            {programName && <><p className="text-sm text-gray-500">Program</p><p className="font-medium text-gray-900">{programName}</p></>}
            <p className="text-sm text-gray-500 mt-2">Date</p>
            <p className="font-medium text-gray-900">{formatDate(session.sessionDate)}</p>
            <p className="text-sm text-gray-500 mt-2">Time</p>
            <p className="font-medium text-gray-900">{formatTime(session.startTime)}</p>
            <p className="text-sm text-gray-500 mt-2">Reference Code</p>
            <p className="font-mono font-bold text-gray-900">{pageState.booking.referenceCode}</p>
            {event?.location && (
              <><p className="text-sm text-gray-500 mt-2">Location</p><p className="font-medium text-gray-900">{event.location}</p></>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => openInOutlook(pageState.booking, session)} className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">📧 Add to Outlook</button>
            <button onClick={() => downloadCalendar(pageState.booking, session)} className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm">📅 Download .ics file</button>
            <a href={backUrl} className="inline-block px-4 py-2 text-white rounded hover:opacity-90 transition-colors" style={{ backgroundColor: brandColor }}>← Back to sessions</a>
            <a href="/cancel" className="text-sm text-red-600 hover:underline">Need to cancel later?</a>
          </div>
        </div>
      </main>
    );
  }

  // --- Multi-Confirmed ---
  if (pageState.kind === 'multi-confirmed') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-green-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Bookings Confirmed</h1>
          <p className="text-gray-600 mb-4">{pageState.bookings.length} session{pageState.bookings.length !== 1 ? 's' : ''} booked successfully.</p>
          <div className="bg-gray-50 rounded p-4 mb-4 text-left space-y-3">
            {programName && <><p className="text-sm text-gray-500">Program</p><p className="font-medium text-gray-900">{programName}</p></>}
            {pageState.bookings.map((booking, idx) => {
              const sess = allSessions[idx];
              return (
                <div key={booking.id} className="border-t border-gray-200 pt-2 first:border-0 first:pt-0">
                  <p className="text-sm text-gray-500 mt-1">Slot {idx + 1}</p>
                  <p className="font-medium text-gray-900">{sess ? `${formatDate(sess.sessionDate)} at ${formatTime(sess.startTime)}` : 'Session booked'}</p>
                  <p className="text-xs text-gray-500">Ref: <span className="font-mono font-bold">{booking.referenceCode}</span></p>
                </div>
              );
            })}
            {event?.location && (
              <><p className="text-sm text-gray-500 mt-2">Location</p><p className="font-medium text-gray-900">{event.location}</p></>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <a href={backUrl} className="inline-block px-4 py-2 text-white rounded hover:opacity-90 transition-colors" style={{ backgroundColor: brandColor }}>← Back to sessions</a>
            <a href="/cancel" className="text-sm text-red-600 hover:underline">Need to cancel later?</a>
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
          <p className="text-gray-600 mb-4">This session is currently full. You have been added to the waitlist.</p>
          <div className="bg-gray-50 rounded p-4 mb-4 text-left space-y-1">
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium text-gray-900">{formatDate(session.sessionDate)}</p>
            <p className="text-sm text-gray-500 mt-2">Time</p>
            <p className="font-medium text-gray-900">{formatTime(session.startTime)}</p>
          </div>
          <a href={backUrl} className="inline-block px-4 py-2 text-white rounded hover:opacity-90 transition-colors" style={{ backgroundColor: brandColor }}>← Back to sessions</a>
        </div>
      </main>
    );
  }

  // --- Session full ---
  if (pageState.kind === 'session-full') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-3" aria-hidden="true">✕</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Session Full</h1>
          <p className="text-gray-600 mb-4">{pageState.message}</p>
          <p className="text-gray-600 mb-6">Would you like to join the waitlist?</p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleJoinWaitlist} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors">Join Waitlist</button>
            <a href={backUrl} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Back to sessions</a>
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
            <button onClick={() => setPageState({ kind: 'form' })} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">Try Again</button>
            <a href={backUrl} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Back to sessions</a>
          </div>
        </div>
      </main>
    );
  }

  // --- Form / Submitting ---
  const isSubmitting = pageState.kind === 'submitting';
  const maxAttendees = session?.maxAttendees || program?.maxAttendees || 3;

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <a href={backUrl} className="text-blue-600 hover:underline text-sm mb-4 inline-block">← Back to sessions</a>

        {session && (
          <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: `${brandColor}10`, borderColor: `${brandColor}40` }}>
            <div className="flex items-center gap-3 mb-2">
              {program?.logoUrl && (
                <Image src={program.logoUrl} alt={`${programName} logo`} width={40} height={40} className="rounded" />
              )}
              <h1 className="text-lg font-bold text-gray-900">Book {programName} Session{allSessions.length > 1 ? 's' : ''}</h1>
            </div>
            {allSessions.length > 1 ? (
              <div className="space-y-1 mt-1">
                <p className="text-sm text-gray-700 font-medium">{allSessions.length} slots selected:</p>
                {allSessions.map((s, i) => (
                  <p key={s.id} className="text-sm text-gray-600">• {formatDate(s.sessionDate)} at {formatTime(s.startTime)}</p>
                ))}
              </div>
            ) : (
              <>
                <p className="text-gray-700 mt-1">{formatDate(session.sessionDate)} at {formatTime(session.startTime)}</p>
                <p className="text-sm text-gray-500 mt-1">{session.bookingCount}/{maxAttendees} booked · {session.slotStatus}</p>
              </>
            )}
          </div>
        )}

        {fieldErrors._form && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">{fieldErrors._form}</div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.name ? 'border-red-400' : 'border-gray-300'}`}
              aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'name-error' : undefined} />
            {fieldErrors.name && <p id="name-error" className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.email ? 'border-red-400' : 'border-gray-300'}`}
              aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
            {fieldErrors.email && <p id="email-error" className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="vpAlias" className="block text-sm font-medium text-gray-700 mb-1">VP Alias <span className="text-red-500">*</span></label>
            <input id="vpAlias" type="text" value={vpAlias} onChange={(e) => setVpAlias(e.target.value)} disabled={isSubmitting}
              placeholder="e.g. jeffb"
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.vpAlias ? 'border-red-400' : 'border-gray-300'}`}
              aria-invalid={!!fieldErrors.vpAlias} aria-describedby={fieldErrors.vpAlias ? 'vpAlias-error' : undefined} />
            {fieldErrors.vpAlias && <p id="vpAlias-error" className="text-red-500 text-xs mt-1">{fieldErrors.vpAlias}</p>}
          </div>

          <div>
            <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">Level <span className="text-red-500">*</span></label>
            <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.level ? 'border-red-400' : 'border-gray-300'}`}
              aria-invalid={!!fieldErrors.level} aria-describedby={fieldErrors.level ? 'level-error' : undefined}>
              <option value="">Select your level...</option>
              <option value="L3">L3</option>
              <option value="L4">L4</option>
              <option value="L5">L5</option>
              <option value="L6">L6</option>
              <option value="L7">L7</option>
              <option value="L8">L8</option>
            </select>
            {fieldErrors.level && <p id="level-error" className="text-red-500 text-xs mt-1">{fieldErrors.level}</p>}
          </div>

          <div>
            <label htmlFor="tenure" className="block text-sm font-medium text-gray-700 mb-1">Tenure at Amazon <span className="text-red-500">*</span></label>
            <select id="tenure" value={tenure} onChange={(e) => setTenure(e.target.value)} disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.tenure ? 'border-red-400' : 'border-gray-300'}`}
              aria-invalid={!!fieldErrors.tenure} aria-describedby={fieldErrors.tenure ? 'tenure-error' : undefined}>
              <option value="">Select your tenure...</option>
              <option value="<1 year">&lt;1 year</option>
              <option value="1-3 years">1-3 years</option>
              <option value="3-5 years">3-5 years</option>
              <option value="5-7 years">5-7 years</option>
              <option value="7-10 years">7-10 years</option>
              <option value="10+ years">10+ years</option>
            </select>
            {fieldErrors.tenure && <p id="tenure-error" className="text-red-500 text-xs mt-1">{fieldErrors.tenure}</p>}
          </div>

          {isDefaultProgram && (
            <>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <input id="role" type="text" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSubmitting}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.role ? 'border-red-400' : 'border-gray-300'}`}
                  aria-invalid={!!fieldErrors.role} aria-describedby={fieldErrors.role ? 'role-error' : undefined} />
                {fieldErrors.role && <p id="role-error" className="text-red-500 text-xs mt-1">{fieldErrors.role}</p>}
              </div>
              <div>
                <label htmlFor="pf" className="block text-sm font-medium text-gray-700 mb-1">PF <span className="text-red-500">*</span></label>
                <input id="pf" type="text" value={pf} onChange={(e) => setPf(e.target.value)} disabled={isSubmitting}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.pf ? 'border-red-400' : 'border-gray-300'}`}
                  aria-invalid={!!fieldErrors.pf} aria-describedby={fieldErrors.pf ? 'pf-error' : undefined} />
                {fieldErrors.pf && <p id="pf-error" className="text-red-500 text-xs mt-1">{fieldErrors.pf}</p>}
              </div>
            </>
          )}

          {!isDefaultProgram && customFormFields.map((field) => (
            <div key={field.name}>
              <label htmlFor={`custom-${field.name}`} className="block text-sm font-medium text-gray-700 mb-1">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  id={`custom-${field.name}`}
                  value={customFieldValues[field.name] || ''}
                  onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  disabled={isSubmitting}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors[`custom_${field.name}`] ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select…</option>
                  {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  id={`custom-${field.name}`}
                  value={customFieldValues[field.name] || ''}
                  onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  disabled={isSubmitting}
                  rows={3}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors[`custom_${field.name}`] ? 'border-red-400' : 'border-gray-300'}`}
                />
              ) : (
                <input
                  id={`custom-${field.name}`}
                  type="text"
                  value={customFieldValues[field.name] || ''}
                  onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  disabled={isSubmitting}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors[`custom_${field.name}`] ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}
              {fieldErrors[`custom_${field.name}`] && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors[`custom_${field.name}`]}</p>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 text-white rounded font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            {isSubmitting ? 'Booking…' : allSessions.length > 1 ? `Book ${allSessions.length} Sessions` : 'Book Session'}
          </button>
        </form>
      </div>
    </main>
  );
}
