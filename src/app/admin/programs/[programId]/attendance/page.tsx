'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, CareerMazeEvent, Program } from '@/models/types';

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

interface AdminBooking {
  id: string; name: string; email: string; role: string; pf: string;
  status: string; referenceCode: string; promotedFromWaitlist: boolean;
  isWaitlisted: boolean;
  vpAlias: string; level: string; attended: boolean;
  sessionDate: string; startTime: string;
  eventTitle: string; eventLocation: string;
}

export default function AttendancePage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [events, setEvents] = useState<CareerMazeEvent[]>([]);
  const [allBookings, setAllBookings] = useState<AdminBooking[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/programs/${programId}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/admin/setup', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/bookings', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([programData, eventsData, bookingsData]) => {
      if (!programData) { setLoading(false); return; }
      setProgram(programData);

      const programEvents = (eventsData as CareerMazeEvent[]).filter(e => e.programId === programId);
      setEvents(programEvents);

      const eventTitles = new Set(programEvents.map(e => e.title));
      const programBookings = (bookingsData as AdminBooking[]).filter(b => eventTitles.has(b.eventTitle));
      setAllBookings(programBookings);
      setSelectedEventIds(new Set(programEvents.map(e => e.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [programId]);

  function toggleEvent(eventId: string) {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }

  function selectAllEvents() { setSelectedEventIds(new Set(events.map(e => e.id))); }
  function clearEvents() { setSelectedEventIds(new Set()); }

  // Filter bookings by selected events
  const filteredBookings = useMemo(() => {
    if (selectedEventIds.size === 0) return allBookings;
    return allBookings.filter(b => events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle));
  }, [allBookings, selectedEventIds, events]);

  const confirmedBookings = useMemo(() => filteredBookings.filter(b => b.status === 'confirmed'), [filteredBookings]);
  const attendedCount = useMemo(() => confirmedBookings.filter(b => b.attended).length, [confirmedBookings]);
  const attendanceRate = confirmedBookings.length > 0 ? Math.round((attendedCount / confirmedBookings.length) * 100) : 0;

  // VP breakdown
  const vpBreakdown = useMemo(() => {
    const map = new Map<string, { booked: number; attended: number }>();
    for (const b of confirmedBookings) {
      const vp = b.vpAlias || '(none)';
      if (!map.has(vp)) map.set(vp, { booked: 0, attended: 0 });
      const entry = map.get(vp)!;
      entry.booked++;
      if (b.attended) entry.attended++;
    }
    return [...map.entries()].sort((a, b) => b[1].booked - a[1].booked);
  }, [confirmedBookings]);

  // Group by date
  const dates = useMemo(() => [...new Set(confirmedBookings.map(b => b.sessionDate))].sort(), [confirmedBookings]);

  async function toggleAttendance(bookingId: string, currentValue: boolean) {
    const newValue = !currentValue;
    setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, attended: newValue } : b));
    await fetch(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attended: newValue }),
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600 text-lg">Loading…</p>
      </main>
    );
  }

  if (!program) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-600 text-lg">Program not found.</p>
      </main>
    );
  }

  const brandColor = program.brandColor || '#1a1a2e';

  return (
    <main className="min-h-screen bg-white">
      <div style={{ backgroundColor: brandColor }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
          {program.logoUrl ? (
            <img src={program.logoUrl} alt={`${program.name} logo`} className="w-20 h-20 rounded-lg object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              {program.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{program.name} — Attendance</h1>
            <p className="mt-1 text-sm opacity-75">{confirmedBookings.length} confirmed bookings</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 sm:px-6 lg:px-8 flex gap-3 flex-wrap">
          <button onClick={() => router.push(`/admin/programs/${programId}`)} className="text-sm opacity-75 hover:opacity-100 transition-opacity">← Back to Program</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Event filter */}
        {events.length >= 1 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Filter by Event</h2>
              <div className="flex gap-2">
                <button onClick={selectAllEvents} className="text-xs text-blue-600 hover:underline">Select All</button>
                <button onClick={clearEvents} className="text-xs text-blue-600 hover:underline">Clear</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {events.map(event => {
                const isSelected = selectedEventIds.has(event.id);
                return (
                  <button key={event.id} onClick={() => toggleEvent(event.id)} className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left ${isSelected ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`} style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}>
                    <div className="font-medium">{event.title}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="rounded-lg border p-4 bg-blue-50 text-blue-800 border-blue-200">
            <div className="text-2xl font-bold">{confirmedBookings.length}</div>
            <div className="text-sm font-medium mt-1">Total Booked</div>
          </div>
          <div className="rounded-lg border p-4 bg-emerald-50 text-emerald-800 border-emerald-200">
            <div className="text-2xl font-bold">{attendedCount}</div>
            <div className="text-sm font-medium mt-1">Attended</div>
          </div>
          <div className="rounded-lg border p-4 bg-violet-50 text-violet-800 border-violet-200">
            <div className="text-2xl font-bold">{attendanceRate}%</div>
            <div className="text-sm font-medium mt-1">Attendance Rate</div>
          </div>
          <div className="rounded-lg border p-4 bg-amber-50 text-amber-800 border-amber-200">
            <div className="text-2xl font-bold">{vpBreakdown.length}</div>
            <div className="text-sm font-medium mt-1">VP Breakdown</div>
            <div className="text-xs mt-0.5 opacity-75">unique VP aliases</div>
          </div>
        </div>

        {/* Attendance list by date */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mark Attendance</h2>
        {dates.map(date => {
          const dateBookings = confirmedBookings.filter(b => b.sessionDate === date);
          return (
            <div key={date} className="mb-4">
              <div className="bg-gray-100 px-3 py-2 rounded-t-lg border border-gray-200 border-b-0">
                <h4 className="font-semibold text-gray-800 text-sm">{formatDateLabel(date)} — {dateBookings.length} attendee{dateBookings.length !== 1 ? 's' : ''}</h4>
              </div>
              <div className="border border-gray-200 rounded-b-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 w-10">✓</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">VP Alias</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Level</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => (
                      <tr key={b.id} className={`border-b border-gray-100 last:border-0 ${b.attended ? 'bg-green-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={b.attended}
                            onChange={() => toggleAttendance(b.id, b.attended)}
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            aria-label={`Mark ${b.name} as ${b.attended ? 'not attended' : 'attended'}`}
                          />
                        </td>
                        <td className="px-3 py-2">{b.name}</td>
                        <td className="px-3 py-2 text-blue-600"><a href={`mailto:${b.email}`}>{b.email}</a></td>
                        <td className="px-3 py-2 text-gray-600">{b.vpAlias || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{b.level || '—'}</td>
                        <td className="px-3 py-2">{formatTime(b.startTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* VP Breakdown table */}
        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">VP Alias Breakdown</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">VP Alias</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Bookings</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attended</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Rate</th>
              </tr>
            </thead>
            <tbody>
              {vpBreakdown.map(([vp, data]) => (
                <tr key={vp} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{vp}</td>
                  <td className="px-3 py-2">{data.booked}</td>
                  <td className="px-3 py-2">{data.attended}</td>
                  <td className="px-3 py-2">{data.booked > 0 ? Math.round((data.attended / data.booked) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
