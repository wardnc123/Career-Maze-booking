'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import type { Session, SlotStatus, CareerMazeEvent } from '@/models/types';

// BST offset: Europe/London in August is UTC+1
const BST_OFFSET_HOURS = 1;

/** Convert UTC time string (HH:MM:SS) to London local time (HH:MM) */
function utcToLondon(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number);
  const londonHour = h + BST_OFFSET_HOURS;
  return `${String(londonHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Date range Aug 3–22, 2026 */
function generateDates(): string[] {
  const dates: string[] = [];
  const current = new Date('2026-08-03T00:00:00Z');
  const end = new Date('2026-08-22T00:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

const STATUS_COLORS: Record<SlotStatus, { bg: string; text: string; label: string }> = {
  Available: { bg: 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100', text: 'text-emerald-800', label: 'Available' },
  Limited: { bg: 'bg-amber-50 border-amber-400 hover:bg-amber-100', text: 'text-amber-800', label: 'Limited' },
  Full: { bg: 'bg-red-50 border-red-400 hover:bg-red-100', text: 'text-red-800', label: 'Full' },
  Waitlisted: { bg: 'bg-violet-50 border-violet-400 hover:bg-violet-100', text: 'text-violet-800', label: 'Waitlisted' },
};

const LEGEND_ITEMS: { status: SlotStatus; dot: string; label: string }[] = [
  { status: 'Available', dot: 'bg-emerald-400', label: 'Available (0 booked)' },
  { status: 'Limited', dot: 'bg-amber-400', label: 'Limited (1–2 booked)' },
  { status: 'Full', dot: 'bg-red-400', label: 'Full (3 booked)' },
  { status: 'Waitlisted', dot: 'bg-violet-400', label: 'Waitlisted' },
];

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export default function BookingPage() {
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<CareerMazeEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter sessions by selected event
  const sessions = useMemo(() => {
    if (!selectedEventId) return allSessions;
    return allSessions.filter((s) => s.eventId === selectedEventId);
  }, [allSessions, selectedEventId]);

  // Selected event
  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedEventId), [events, selectedEventId]);

  // Derive unique sorted dates from sessions
  const allDates = useMemo(() => {
    const dates = [...new Set(sessions.map((s) => s.sessionDate))].sort();
    return dates;
  }, [sessions]);

  // Auto-select first date when sessions load
  useEffect(() => {
    if (allDates.length > 0 && !selectedDate) {
      setSelectedDate(allDates[0]);
    }
  }, [allDates, selectedDate]);

  // Derive date range label
  const dateRangeLabel = useMemo(() => {
    if (allDates.length === 0) return '';
    const first = new Date(allDates[0] + 'T00:00:00Z');
    const last = new Date(allDates[allDates.length - 1] + 'T00:00:00Z');
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return `${fmt(first)} – ${fmt(last)}`;
  }, [allDates]);

  // Fetch sessions and events on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [sessionsRes, eventsRes] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/admin/setup'),
        ]);
        if (!sessionsRes.ok) throw new Error('Failed to load sessions');
        const [sessionsData, eventsData] = await Promise.all([sessionsRes.json(), eventsRes.json()]);
        if (!cancelled) {
          setAllSessions(sessionsData);
          setEvents(eventsData);
          // Auto-select first event
          if (eventsData.length > 0) setSelectedEventId(eventsData[0].id);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

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
      } catch { /* ignore parse errors */ }
    });

    eventSource.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => eventSource.close();
  }, []);

  // Group sessions for selected date into morning/afternoon
  const { morning, afternoon } = useMemo(() => {
    const daySessions = sessions
      .filter((s) => s.sessionDate === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const morningSlots: Session[] = [];
    const afternoonSlots: Session[] = [];

    for (const s of daySessions) {
      const londonTime = utcToLondon(s.startTime);
      const hour = parseInt(londonTime.split(':')[0], 10);
      if (hour < 13) {
        morningSlots.push(s);
      } else {
        afternoonSlots.push(s);
      }
    }

    return { morning: morningSlots, afternoon: afternoonSlots };
  }, [sessions, selectedDate]);

  const handleSlotClick = useCallback((session: Session) => {
    window.location.href = `/book/${session.id}`;
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600 text-lg">Loading sessions…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-600 text-lg">Error: {error}</p>
      </main>
    );
  }

  if (events.length === 0) {
    return (
      <main className="min-h-screen bg-white">
        <div className="bg-[#1a1a2e] text-white">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
            <Image src="/career-maze-logo.jpg" alt="Career Maze logo" width={80} height={80} className="rounded-lg" />
            <h1 className="text-2xl sm:text-3xl font-bold">Career Maze Session Booking</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-600 text-lg mb-4">No events are currently available for booking.</p>
          <p className="text-gray-500 text-sm">Check back soon, or contact the organiser for details.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Branded header */}
      <div className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
          <Image
            src="/career-maze-logo.jpg"
            alt="Career Maze logo"
            width={80}
            height={80}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Career Maze Session Booking
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              {selectedEvent ? selectedEvent.title : dateRangeLabel} · All times in Europe/London
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Event selector (shown when multiple events exist) */}
        {events.length > 1 && (
          <div className="mb-6">
            <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-1">Select Event</label>
            <select
              id="event-select"
              value={selectedEventId}
              onChange={(e) => { setSelectedEventId(e.target.value); setSelectedDate(''); }}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6" role="list" aria-label="Slot status legend">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.status} className="flex items-center gap-1.5 text-sm" role="listitem">
              <span className={`inline-block w-3 h-3 rounded-full ${item.dot}`} aria-hidden="true" />
              <span className="text-gray-700">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Date navigation */}
        <nav aria-label="Date navigation" className="mb-6 overflow-x-auto">
          <div className="flex gap-1 sm:gap-2 min-w-max pb-2">
            {allDates.map((date) => {
              const isSelected = date === selectedDate;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-[#1a1a2e] text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`Select ${formatDateLabel(date)}`}
                >
                  {formatDateLabel(date)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Session grid */}
        <SessionBlock title="Morning (9:00 – 12:00)" sessions={morning} onSlotClick={handleSlotClick} />
        <SessionBlock title="Afternoon (14:00 – 15:15)" sessions={afternoon} onSlotClick={handleSlotClick} />
      </div>
    </main>
  );
}

function SessionBlock({
  title,
  sessions,
  onSlotClick,
}: {
  title: string;
  sessions: Session[];
  onSlotClick: (s: Session) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-2 sm:gap-3">
        {sessions.map((session) => {
          const londonTime = utcToLondon(session.startTime);
          const style = STATUS_COLORS[session.slotStatus];
          return (
            <button
              key={session.id}
              onClick={() => onSlotClick(session)}
              className={`rounded-lg border p-3 text-center transition-colors cursor-pointer ${style.bg}`}
              aria-label={`${londonTime} — ${style.label} (${session.bookingCount}/3 booked)`}
            >
              <div className={`text-sm sm:text-base font-semibold ${style.text}`}>
                {londonTime}
              </div>
              <div className={`text-xs mt-0.5 ${style.text} opacity-75`}>
                {session.bookingCount}/3
              </div>
              <div className={`text-xs mt-0.5 ${style.text}`}>
                {style.label}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
