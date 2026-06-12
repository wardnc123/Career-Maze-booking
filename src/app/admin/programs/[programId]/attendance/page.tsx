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
  vpAlias: string; level: string; tenure: string; attended: boolean;
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
  const [recordedEventIds, setRecordedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load recorded event IDs from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`attendance-recorded-${programId}`);
    if (saved) {
      try {
        setRecordedEventIds(new Set(JSON.parse(saved)));
      } catch { /* ignore bad data */ }
    }
  }, [programId]);

  // Save recorded event IDs to localStorage when changed
  useEffect(() => {
    if (recordedEventIds.size > 0 || localStorage.getItem(`attendance-recorded-${programId}`)) {
      localStorage.setItem(`attendance-recorded-${programId}`, JSON.stringify([...recordedEventIds]));
    }
  }, [recordedEventIds, programId]);

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

  // Split events into active (not recorded) and recorded
  const activeEventsForAttendance = useMemo(
    () => events.filter(ev => !recordedEventIds.has(ev.id)),
    [events, recordedEventIds]
  );
  const recordedEventsForAttendance = useMemo(
    () => events.filter(ev => recordedEventIds.has(ev.id)),
    [events, recordedEventIds]
  );

  function toggleEvent(eventId: string) {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }

  function selectAllEvents() {
    // Only select active events in filter
    setSelectedEventIds(new Set(activeEventsForAttendance.map(e => e.id)));
  }
  function clearEvents() { setSelectedEventIds(new Set()); }

  // Filter bookings: only from active (non-recorded) events that are also selected
  const filteredBookings = useMemo(() => {
    const activeEventIds = new Set(activeEventsForAttendance.map(ev => ev.id));
    return allBookings.filter(b => {
      const matchingEvent = events.find(ev => ev.title === b.eventTitle);
      if (!matchingEvent) return false;
      if (!activeEventIds.has(matchingEvent.id)) return false;
      if (selectedEventIds.size > 0 && !selectedEventIds.has(matchingEvent.id)) return false;
      return true;
    });
  }, [allBookings, selectedEventIds, events, activeEventsForAttendance]);

  // Bookings for recorded section
  const recordedBookings = useMemo(() => {
    const recordedIds = new Set(recordedEventsForAttendance.map(ev => ev.id));
    return allBookings.filter(b => {
      const matchingEvent = events.find(ev => ev.title === b.eventTitle);
      return matchingEvent && recordedIds.has(matchingEvent.id);
    });
  }, [allBookings, events, recordedEventsForAttendance]);

  const confirmedBookings = useMemo(() => filteredBookings.filter(b => b.status === 'confirmed'), [filteredBookings]);
  const attendedCount = useMemo(() => confirmedBookings.filter(b => b.attended).length, [confirmedBookings]);
  const attendanceRate = confirmedBookings.length > 0 ? Math.round((attendedCount / confirmedBookings.length) * 100) : 0;

  // Total stats across all events (active + recorded)
  const allConfirmedBookings = useMemo(() => allBookings.filter(b => b.status === 'confirmed'), [allBookings]);
  const totalAttendedCount = useMemo(() => allConfirmedBookings.filter(b => b.attended).length, [allConfirmedBookings]);

  // VP breakdown (active events only)
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

  // Group by date (active events)
  const dates = useMemo(() => [...new Set(confirmedBookings.map(b => b.sessionDate))].sort(), [confirmedBookings]);

  // Group recorded bookings by event then date
  const recordedConfirmedBookings = useMemo(() => recordedBookings.filter(b => b.status === 'confirmed'), [recordedBookings]);
  const recordedDates = useMemo(() => [...new Set(recordedConfirmedBookings.map(b => b.sessionDate))].sort(), [recordedConfirmedBookings]);

  async function toggleAttendance(bookingId: string, currentValue: boolean) {
    const newValue = !currentValue;
    setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, attended: newValue } : b));
    await fetch(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attended: newValue }),
    });
  }

  function recordAllActiveAttendance() {
    if (!confirm('Record attendance for all visible events? They will move to the recorded section.')) return;
    const activeIds = activeEventsForAttendance.filter(ev => selectedEventIds.has(ev.id)).map(ev => ev.id);
    if (activeIds.length === 0) return;
    setRecordedEventIds(prev => {
      const next = new Set(prev);
      activeIds.forEach(id => next.add(id));
      return next;
    });
  }

  function undoRecordedEvent(eventId: string) {
    setRecordedEventIds(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
    // Also add it back to selected
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
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
            <p className="mt-1 text-sm opacity-75">{confirmedBookings.length} active bookings{recordedEventsForAttendance.length > 0 ? ` · ${recordedConfirmedBookings.length} recorded` : ''}</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 sm:px-6 lg:px-8 flex gap-3 flex-wrap">
          <button onClick={() => router.push(`/admin/programs/${programId}`)} className="text-sm opacity-75 hover:opacity-100 transition-opacity">← Back to Program</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Event filter — only shows active (non-recorded) events */}
        {activeEventsForAttendance.length >= 1 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Filter by Event</h2>
              <div className="flex gap-2">
                <button onClick={selectAllEvents} className="text-xs text-blue-600 hover:underline">Select All</button>
                <button onClick={clearEvents} className="text-xs text-blue-600 hover:underline">Clear</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeEventsForAttendance.map(event => {
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

        {/* Stats cards — counts from active events only */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="rounded-lg border p-4 bg-blue-50 text-blue-800 border-blue-200">
            <div className="text-2xl font-bold">{confirmedBookings.length}</div>
            <div className="text-sm font-medium mt-1">Total Booked</div>
            {recordedEventsForAttendance.length > 0 && (
              <div className="text-xs mt-0.5 opacity-75">({allConfirmedBookings.length} incl. recorded)</div>
            )}
          </div>
          <div className="rounded-lg border p-4 bg-emerald-50 text-emerald-800 border-emerald-200">
            <div className="text-2xl font-bold">{attendedCount}</div>
            <div className="text-sm font-medium mt-1">Attended</div>
            {recordedEventsForAttendance.length > 0 && (
              <div className="text-xs mt-0.5 opacity-75">({totalAttendedCount} incl. recorded)</div>
            )}
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

        {/* Attendance list by date — active events only */}
        {dates.length > 0 && (
          <>
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

            {/* Record Attendance button */}
            <button
              onClick={recordAllActiveAttendance}
              className="w-full py-3 px-4 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors text-lg mt-8"
            >
              ✓ Record Attendance
            </button>
          </>
        )}

        {dates.length === 0 && activeEventsForAttendance.length > 0 && (
          <p className="text-gray-500 text-sm mb-4">No confirmed bookings for active events.</p>
        )}

        {dates.length === 0 && activeEventsForAttendance.length === 0 && recordedEventsForAttendance.length > 0 && (
          <p className="text-gray-500 text-sm mb-4">All events have been recorded. Check the &quot;Recorded Attendance&quot; section below.</p>
        )}

        {/* Recorded Attendance collapsible section */}
        {recordedEventsForAttendance.length > 0 && (
          <details className="mt-8">
            <summary className="text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-800">
              Recorded Attendance ({recordedEventsForAttendance.length} event{recordedEventsForAttendance.length !== 1 ? 's' : ''})
            </summary>
            <div className="mt-4 opacity-90">
              {recordedEventsForAttendance.map(event => {
                const eventBookings = recordedConfirmedBookings.filter(b => b.eventTitle === event.title);
                const eventDates = [...new Set(eventBookings.map(b => b.sessionDate))].sort();
                const eventAttended = eventBookings.filter(b => b.attended).length;
                return (
                  <div key={event.id} className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-700">{event.title}</h4>
                        <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">[RECORDED]</span>
                        <span className="text-xs text-gray-500">{eventAttended}/{eventBookings.length} attended</span>
                      </div>
                      <button
                        onClick={() => undoRecordedEvent(event.id)}
                        className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors font-medium"
                      >
                        ↩ Undo
                      </button>
                    </div>
                    <div className="p-3">
                      {eventDates.map(date => {
                        const dateBookings = eventBookings.filter(b => b.sessionDate === date);
                        return (
                          <div key={date} className="mb-3 last:mb-0">
                            <div className="bg-gray-100 px-3 py-1.5 rounded-t border border-gray-200 border-b-0">
                              <h5 className="font-medium text-gray-600 text-xs">{formatDateLabel(date)} — {dateBookings.length} attendee{dateBookings.length !== 1 ? 's' : ''}</h5>
                            </div>
                            <div className="border border-gray-200 rounded-b overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    <th className="text-left px-3 py-1.5 font-medium text-gray-600 w-10 text-xs">✓</th>
                                    <th className="text-left px-3 py-1.5 font-medium text-gray-600 text-xs">Name</th>
                                    <th className="text-left px-3 py-1.5 font-medium text-gray-600 text-xs">Email</th>
                                    <th className="text-left px-3 py-1.5 font-medium text-gray-600 text-xs">VP Alias</th>
                                    <th className="text-left px-3 py-1.5 font-medium text-gray-600 text-xs">Level</th>
                                    <th className="text-left px-3 py-1.5 font-medium text-gray-600 text-xs">Time</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dateBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => (
                                    <tr key={b.id} className={`border-b border-gray-100 last:border-0 ${b.attended ? 'bg-green-50/50' : 'bg-white'}`}>
                                      <td className="px-3 py-1.5">
                                        <input
                                          type="checkbox"
                                          checked={b.attended}
                                          onChange={() => toggleAttendance(b.id, b.attended)}
                                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                          aria-label={`Mark ${b.name} as ${b.attended ? 'not attended' : 'attended'}`}
                                        />
                                      </td>
                                      <td className="px-3 py-1.5 text-gray-600">{b.name}</td>
                                      <td className="px-3 py-1.5 text-blue-500"><a href={`mailto:${b.email}`}>{b.email}</a></td>
                                      <td className="px-3 py-1.5 text-gray-500">{b.vpAlias || '—'}</td>
                                      <td className="px-3 py-1.5 text-gray-500">{b.level || '—'}</td>
                                      <td className="px-3 py-1.5 text-gray-500">{formatTime(b.startTime)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                      {eventBookings.length === 0 && (
                        <p className="text-gray-400 text-sm">No confirmed bookings for this event.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* VP Breakdown table */}
        {vpBreakdown.length > 0 && (
          <>
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
          </>
        )}
      </div>
    </main>
  );
}
