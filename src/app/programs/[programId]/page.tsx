'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import type { Session, SlotStatus, CareerMazeEvent, Program } from '@/models/types';

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const STATUS_COLORS: Record<SlotStatus, { bg: string; text: string; label: string }> = {
  Available: { bg: 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100', text: 'text-emerald-800', label: 'Available' },
  Limited: { bg: 'bg-amber-50 border-amber-400 hover:bg-amber-100', text: 'text-amber-800', label: 'Limited' },
  Full: { bg: 'bg-red-50 border-red-400 hover:bg-red-100', text: 'text-red-800', label: 'Full' },
  Waitlisted: { bg: 'bg-violet-50 border-violet-400 hover:bg-violet-100', text: 'text-violet-800', label: 'Waitlisted' },
};

const LEGEND_ITEMS: { status: SlotStatus; dot: string; label: string }[] = [
  { status: 'Available', dot: 'bg-emerald-400', label: 'Available' },
  { status: 'Limited', dot: 'bg-amber-400', label: 'Limited' },
  { status: 'Full', dot: 'bg-red-400', label: 'Full' },
  { status: 'Waitlisted', dot: 'bg-violet-400', label: 'Waitlisted' },
];

export default function ProgramBookingPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const [program, setProgram] = useState<Program | null>(null);
  const [events, setEvents] = useState<CareerMazeEvent[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter sessions by selected event
  const sessions = useMemo(() => {
    if (!selectedEventId) return allSessions;
    return allSessions.filter((s) => s.eventId === selectedEventId);
  }, [allSessions, selectedEventId]);

  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedEventId), [events, selectedEventId]);

  const allDates = useMemo(() => {
    return [...new Set(sessions.map((s) => s.sessionDate))].sort();
  }, [sessions]);

  useEffect(() => {
    if (allDates.length > 0 && !selectedDate) {
      setSelectedDate(allDates[0]);
    }
  }, [allDates, selectedDate]);

  const dateRangeLabel = useMemo(() => {
    if (allDates.length === 0) return '';
    const first = new Date(allDates[0] + 'T00:00:00Z');
    const last = new Date(allDates[allDates.length - 1] + 'T00:00:00Z');
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return `${fmt(first)} – ${fmt(last)}`;
  }, [allDates]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { programId } = await params;
        const [progRes, eventsRes, sessionsRes] = await Promise.all([
          fetch(`/api/programs/${programId}`, { cache: 'no-store' }),
          fetch('/api/admin/setup', { cache: 'no-store' }),
          fetch('/api/sessions', { cache: 'no-store' }),
        ]);
        if (!progRes.ok) { if (!cancelled) setError('Program not found'); setLoading(false); return; }
        const prog: Program = await progRes.json();
        const allEvents: CareerMazeEvent[] = await eventsRes.json();
        const allSess: Session[] = await sessionsRes.json();
        if (cancelled) return;

        const programEvents = allEvents.filter((e) => e.programId === programId);
        const programEventIds = new Set(programEvents.map((e) => e.id));
        const programSessions = allSess.filter((s) => programEventIds.has(s.eventId));

        // Filter out past sessions
        const today = new Date().toISOString().slice(0, 10);
        const futureSessions = programSessions.filter(s => s.sessionDate >= today);

        // Filter out events that have no future sessions remaining
        const eventsWithFutureSessions = programEvents.filter(ev => {
          return futureSessions.some(s => s.eventId === ev.id);
        });

        setProgram(prog);
        setEvents(eventsWithFutureSessions);
        setAllSessions(futureSessions);
        // Only auto-select if there's exactly 1 event; otherwise leave unselected
        if (eventsWithFutureSessions.length === 1) setSelectedEventId(eventsWithFutureSessions[0].id);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [params]);

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    eventSource.addEventListener('session:updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        setAllSessions((prev) =>
          prev.map((s) =>
            s.id === data.sessionId
              ? { ...s, bookingCount: data.bookingCount, slotStatus: data.slotStatus }
              : s
          )
        );
      } catch { /* ignore */ }
    });
    eventSource.onerror = () => {};
    return () => eventSource.close();
  }, []);

  const { morning, afternoon } = useMemo(() => {
    const daySessions = sessions
      .filter((s) => s.sessionDate === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const m: Session[] = [];
    const a: Session[] = [];
    for (const s of daySessions) {
      const hour = parseInt(formatTime(s.startTime).split(':')[0], 10);
      if (hour < 13) m.push(s); else a.push(s);
    }
    return { morning: m, afternoon: a };
  }, [sessions, selectedDate]);

  const handleSlotClick = useCallback((session: Session) => {
    if (selectedEvent?.allowMultiSlot) {
      // Multi-select mode
      setSelectedSessionIds(prev => {
        const next = new Set(prev);
        if (next.has(session.id)) next.delete(session.id); else next.add(session.id);
        return next;
      });
    } else {
      // Single-select mode — navigate directly
      window.location.href = `/book/${session.id}`;
    }
  }, [selectedEvent]);

  const brandColor = program?.brandColor || '#1a1a2e';

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600 text-lg">Loading…</p>
      </main>
    );
  }

  if (error || !program) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error || 'Program not found'}</p>
          <a href="/" className="text-blue-600 hover:underline">← Back to programs</a>
        </div>
      </main>
    );
  }

  if (events.length === 0) {
    return (
      <main className="min-h-screen bg-white">
        <div style={{ backgroundColor: brandColor }} className="text-white">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
            {program.logoUrl ? (
              <Image src={program.logoUrl} alt={`${program.name} logo`} width={80} height={80} className="rounded-lg" />
            ) : (
              <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white text-2xl font-bold bg-white/20">
                {program.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold">{program.name} Session Booking</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-600 text-lg mb-4">No events are currently available for booking.</p>
          <p className="text-gray-500 text-sm">Check back soon, or contact the organiser for details.</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">← Back to programs</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div style={{ backgroundColor: brandColor }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
          {program.logoUrl ? (
            <Image src={program.logoUrl} alt={`${program.name} logo`} width={80} height={80} className="rounded-lg" />
          ) : (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white text-2xl font-bold bg-white/20">
              {program.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{program.name} Session Booking</h1>
            <p className="mt-1 text-sm text-gray-200">
              {selectedEvent ? selectedEvent.title : dateRangeLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {events.length > 1 && (
          <div className="mb-6">
            <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-1">Select Event</label>
            <select
              id="event-select"
              value={selectedEventId}
              onChange={(e) => { setSelectedEventId(e.target.value); setSelectedDate(''); }}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              <option value="">Select an event...</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>
        )}

        {selectedEventId === '' ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">Please select an event above to see available time slots.</p>
          </div>
        ) : (
          <>
            {selectedEvent?.rooms && selectedEvent.rooms.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-1">📍 Meeting Location</h3>
                {selectedEvent.rooms.map((r, i) => (
                  <p key={i} className="text-sm text-gray-600">{r.building} — Room {r.room}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-4 mb-6" role="list" aria-label="Slot status legend">
              {LEGEND_ITEMS.map((item) => (
                <div key={item.status} className="flex items-center gap-1.5 text-sm" role="listitem">
                  <span className={`inline-block w-3 h-3 rounded-full ${item.dot}`} aria-hidden="true" />
                  <span className="text-gray-700">{item.label}</span>
                </div>
              ))}
            </div>

            <nav aria-label="Date navigation" className="mb-6 overflow-x-auto">
              <div className="flex gap-1 sm:gap-2 min-w-max pb-2">
                {allDates.map((date) => {
                  const isSelected = date === selectedDate;
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                        isSelected ? 'text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                      style={isSelected ? { backgroundColor: brandColor } : undefined}
                      aria-pressed={isSelected}
                      aria-label={`Select ${formatDateLabel(date)}`}
                    >
                      {formatDateLabel(date)}
                    </button>
                  );
                })}
              </div>
            </nav>

            <SessionBlock title="Morning" sessions={morning} onSlotClick={handleSlotClick} maxAttendees={program.maxAttendees} selectedSessionIds={selectedSessionIds} brandColor={brandColor} />
            <SessionBlock title="Afternoon" sessions={afternoon} onSlotClick={handleSlotClick} maxAttendees={program.maxAttendees} selectedSessionIds={selectedSessionIds} brandColor={brandColor} />
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-2">Need to manage your bookings?</p>
          <div className="flex gap-4 justify-center">
            <a href="/my-bookings" className="text-sm text-blue-600 hover:underline font-medium">My Bookings</a>
            <a href="/cancel" className="text-sm text-red-600 hover:underline font-medium">Cancel a Booking</a>
            <a href="/" className="text-sm text-gray-600 hover:underline font-medium">All Programs</a>
          </div>
        </div>
      </div>

      {selectedEvent?.allowMultiSlot && selectedSessionIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-sm text-gray-700">
              {selectedSessionIds.size} slot{selectedSessionIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <button onClick={() => setSelectedSessionIds(new Set())} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                Clear
              </button>
              <button onClick={() => {
                const ids = [...selectedSessionIds].join(',');
                window.location.href = `/book/${ids}`;
              }} className="px-4 py-2 text-sm text-white rounded hover:opacity-90" style={{ backgroundColor: brandColor }}>
                Confirm {selectedSessionIds.size} Slot{selectedSessionIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SessionBlock({
  title,
  sessions,
  onSlotClick,
  maxAttendees,
  selectedSessionIds,
  brandColor,
}: {
  title: string;
  sessions: Session[];
  onSlotClick: (s: Session) => void;
  maxAttendees: number;
  selectedSessionIds: Set<string>;
  brandColor: string;
}) {
  if (sessions.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-2 sm:gap-3">
        {sessions.map((session) => {
          const londonTime = formatTime(session.startTime);
          const style = STATUS_COLORS[session.slotStatus];
          const capacity = session.maxAttendees || maxAttendees;
          const isSelected = selectedSessionIds.has(session.id);
          return (
            <button
              key={session.id}
              onClick={() => onSlotClick(session)}
              className={`rounded-lg border p-3 text-center transition-colors cursor-pointer ${style.bg} ${isSelected ? 'ring-2 ring-offset-2' : ''}`}
              style={isSelected ? { '--tw-ring-color': brandColor } as React.CSSProperties : undefined}
              aria-label={`${londonTime} — ${style.label} (${session.bookingCount}/${capacity} booked)${isSelected ? ' (selected)' : ''}`}
              aria-pressed={isSelected}
            >
              <div className={`text-sm sm:text-base font-semibold ${style.text}`}>{londonTime}</div>
              <div className={`text-xs mt-0.5 ${style.text} opacity-75`}>{session.bookingCount}/{capacity}</div>
              <div className={`text-xs mt-0.5 ${style.text}`}>{style.label}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
