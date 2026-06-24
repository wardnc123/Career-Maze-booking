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

function getBadge(count: number, max: number): { bg: string; label: string } {
  if (count === 0) return { bg: 'bg-emerald-100 text-emerald-800', label: 'Empty' };
  if (count < max) return { bg: 'bg-amber-100 text-amber-800', label: `${count}/${max}` };
  return { bg: 'bg-red-100 text-red-800', label: 'Full' };
}

function getRowColor(count: number, max: number): string {
  if (count === 0) return 'bg-emerald-50';
  if (count < max) return 'bg-amber-50';
  return 'bg-red-50';
}

interface AdminBooking {
  id: string; name: string; email: string; role: string; pf: string;
  status: string; referenceCode: string; promotedFromWaitlist: boolean;
  isWaitlisted: boolean;
  vpAlias: string; level: string; tenure: string; attended: boolean;
  sessionDate: string; startTime: string;
  eventTitle: string; eventLocation: string;
}

export default function ProgramEventManagementPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<CareerMazeEvent[]>([]);
  const [allBookings, setAllBookings] = useState<AdminBooking[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showAttendees, setShowAttendees] = useState(false);
  const [hideCancelled, setHideCancelled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/programs/${programId}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/sessions', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/setup', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/bookings', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([programData, sessionsData, eventsData, bookingsData]) => {
      if (!programData) {
        setLoading(false);
        return;
      }
      setProgram(programData);

      // Filter events by programId
      const programEvents = (eventsData as CareerMazeEvent[]).filter(e => e.programId === programId);
      setEvents(programEvents);

      const programEventIds = new Set(programEvents.map(e => e.id));

      // Filter sessions by program events
      const programSessions = (sessionsData as Session[]).filter(s => programEventIds.has(s.eventId));
      // Exclude weekend sessions from display
      const weekdaySessions = programSessions.filter(s => {
        const d = new Date(s.sessionDate + 'T00:00:00Z');
        const day = d.getUTCDay();
        return day !== 0 && day !== 6;
      });
      setAllSessions(weekdaySessions);

      // Filter bookings by program events
      const eventTitles = new Set(programEvents.map(e => e.title));
      const programBookings = (bookingsData as AdminBooking[]).filter(b => eventTitles.has(b.eventTitle));
      setAllBookings(programBookings);

      // Only select active events by default (those with at least one future session)
      const today = new Date().toISOString().slice(0, 10);
      const activeEvents = programEvents.filter(ev => {
        const eventSessions = programSessions.filter(s => s.eventId === ev.id);
        return eventSessions.some(s => s.sessionDate >= today);
      });
      setSelectedEventIds(new Set(activeEvents.map(e => e.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [programId]);

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('session:updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        setAllSessions(prev => prev.map(s =>
          s.id === data.sessionId ? { ...s, bookingCount: data.bookingCount, slotStatus: data.slotStatus } : s
        ));
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, []);

  // Split events into active and completed
  const { activeEvents, completedEvents } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = events.filter(ev => {
      const eventSessions = allSessions.filter(s => s.eventId === ev.id);
      return eventSessions.some(s => s.sessionDate >= today);
    });
    const completed = events.filter(ev => {
      const eventSessions = allSessions.filter(s => s.eventId === ev.id);
      return eventSessions.length > 0 && eventSessions.every(s => s.sessionDate < today);
    });
    return { activeEvents: active, completedEvents: completed };
  }, [events, allSessions]);

  // Filter sessions by selected events
  const sessions = useMemo(() => {
    if (selectedEventIds.size === 0) return allSessions;
    return allSessions.filter(s => selectedEventIds.has(s.eventId));
  }, [allSessions, selectedEventIds]);

  const maxAtt = program?.maxAttendees || 3;

  // Stats
  const stats = useMemo(() => {
    const total = sessions.length;
    const totalBooked = sessions.reduce((sum, s) => sum + s.bookingCount, 0);
    const totalCapacity = sessions.reduce((sum, s) => sum + (s.maxAttendees || maxAtt), 0);
    const full = sessions.filter(s => s.bookingCount >= (s.maxAttendees || maxAtt)).length;
    const empty = sessions.filter(s => s.bookingCount === 0).length;
    const partial = total - full - empty;
    const utilisation = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;
    return { total, totalBooked, totalCapacity, full, empty, partial, utilisation };
  }, [sessions, maxAtt]);

  // Group by date
  const allDates = useMemo(() => [...new Set(sessions.map(s => s.sessionDate))].sort(), [sessions]);
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const date of allDates) {
      map.set(date, sessions.filter(s => s.sessionDate === date).sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  }, [sessions, allDates]);

  function toggleEvent(eventId: string) {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }

  function selectAllEvents() { setSelectedEventIds(new Set(events.map(e => e.id))); }
  function clearEvents() { setSelectedEventIds(new Set()); }

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
            <h1 className="text-2xl sm:text-3xl font-bold">{program.name}</h1>
            <p className="mt-1 text-sm opacity-75">{events.length} event{events.length !== 1 ? 's' : ''} · {stats.total} sessions</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 sm:px-6 lg:px-8 flex gap-3 flex-wrap">
          <a href={`/admin/setup?programId=${programId}`} className="text-sm opacity-75 hover:opacity-100 transition-opacity">+ Create New Event</a>
          <a href={`/programs/${programId}`} className="text-sm opacity-75 hover:opacity-100 transition-opacity" target="_blank" rel="noopener noreferrer">🔗 View Booking Page</a>
          <button onClick={async () => { if (!confirm('Send reminder emails to all attendees with sessions tomorrow?')) return; try { const res = await fetch('/api/cron/reminders', { method: 'POST' }); const data = await res.json(); if (res.ok) { alert(`Done! ${data.remindersSent} reminder(s) sent for ${data.sessionsProcessed} session(s).`); } else { alert(data.error || 'Failed to send reminders'); } } catch { alert('Network error'); } }} className="text-sm opacity-75 hover:opacity-100 transition-opacity">📧 Send Reminders</button>
          <button onClick={() => router.push(`/admin/programs/${programId}/settings`)} className="text-sm opacity-75 hover:opacity-100 transition-opacity">⚙️ Settings</button>
          <button onClick={() => router.push(`/admin/programs/${programId}/attendance`)} className="text-sm opacity-75 hover:opacity-100 transition-opacity">📋 Attendance</button>
          <button onClick={() => router.push(`/admin/programs/${programId}/insights`)} className="text-sm opacity-75 hover:opacity-100 transition-opacity">📊 Insights</button>
          <button onClick={() => router.push('/admin/programs')} className="text-sm opacity-75 hover:opacity-100 transition-opacity">← All Programs</button>
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
              {activeEvents.map(event => {
                const isSelected = selectedEventIds.has(event.id);
                const eventSessions = allSessions.filter(s => s.eventId === event.id);
                const booked = eventSessions.reduce((sum, s) => sum + s.bookingCount, 0);
                const capacity = eventSessions.reduce((sum, s) => sum + (s.maxAttendees || maxAtt), 0);
                return (
                  <div key={event.id} className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left ${isSelected ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`} style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}>
                    <button onClick={() => toggleEvent(event.id)} className="w-full text-left">
                      <div className="font-medium">{event.title}</div>
                      <div className={`text-xs mt-0.5 ${isSelected ? 'opacity-75' : 'text-gray-500'}`}>{eventSessions.length} sessions · {booked}/{capacity} booked</div>
                    </button>
                    <div className="flex gap-2 mt-1">
                      <a href={`/admin/edit/${event.id}`} className={`text-xs ${isSelected ? 'opacity-75 hover:opacity-100' : 'text-blue-600 hover:underline'}`}>✏️ Edit</a>
                      <button onClick={async (e) => { e.stopPropagation(); if(!confirm(`Delete "${event.title}"?`)) return; setEvents(prev => prev.filter(ev => ev.id !== event.id)); setAllSessions(prev => prev.filter(s => s.eventId !== event.id)); setSelectedEventIds(prev => { const n = new Set(prev); n.delete(event.id); return n; }); fetch(`/api/admin/setup/${event.id}`,{method:'DELETE'}).catch(() => {}); }} className={`text-xs ${isSelected ? 'text-red-200 hover:text-red-100' : 'text-red-500 hover:underline'}`}>🗑️ Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {completedEvents.length > 0 && (
              <details className="mb-6 mt-4">
                <summary className="text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-800">
                  Completed Events ({completedEvents.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {completedEvents.map(event => (
                    <div key={event.id} className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500">
                      <div className="font-medium">{event.title} <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded ml-1">[COMPLETED]</span></div>
                      <button onClick={() => toggleEvent(event.id)} className="text-xs text-blue-500 hover:underline mt-1">
                        {selectedEventIds.has(event.id) ? 'Hide from view' : 'Show in view'}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard label="Total Bookings" value={stats.totalBooked} sub={`of ${stats.totalCapacity} capacity`} color="bg-blue-50 text-blue-800 border-blue-200" />
          <StatCard label="Utilisation" value={`${stats.utilisation}%`} sub={`${stats.full} full sessions`} color="bg-emerald-50 text-emerald-800 border-emerald-200" />
          <StatCard label="Empty Sessions" value={stats.empty} sub={`of ${stats.total} total`} color="bg-amber-50 text-amber-800 border-amber-200" />
          <StatCard label="Partially Booked" value={stats.partial} sub={`of ${stats.total} total`} color="bg-violet-50 text-violet-800 border-violet-200" />
          <StatCard label="Fully Booked" value={stats.full} sub={`of ${stats.total} total`} color="bg-red-50 text-red-800 border-red-200" />
          <StatCard label="Attendance" value={`${allBookings.filter(b => b.attended && b.status === 'confirmed').length}/${allBookings.filter(b => b.status === 'confirmed').length}`} sub="attended / confirmed" color="bg-cyan-50 text-cyan-800 border-cyan-200" />
        </div>

        {/* Attendees section */}
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <button onClick={() => setShowAttendees(!showAttendees)} className="px-4 py-2 text-white text-sm rounded hover:opacity-90" style={{ backgroundColor: brandColor }}>
            {showAttendees ? 'Hide Attendees' : 'Show Attendees'}
          </button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hideCancelled}
              onChange={(e) => setHideCancelled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
            />
            Hide cancelled
          </label>
          <button onClick={() => {
            const filtered = allBookings.filter(b => b.status === 'confirmed' && (selectedEventIds.size === 0 || events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle)));
            const csv = 'Program,Event,Name,Email,Role,PF,Date,Time,Status,Reference\n' + filtered.map(b => `"${program.name}","${b.eventTitle}","${b.name}","${b.email}","${b.role}","${b.pf}","${b.sessionDate}","${b.startTime.slice(0,5)}","${b.status}","${b.referenceCode}"`).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${program.name.toLowerCase().replace(/\s+/g, '-')}-bookings.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700">
            Export CSV
          </button>
          <span className="text-sm text-gray-500">{allBookings.filter(b => b.status === 'confirmed').length} confirmed bookings</span>
          <button onClick={() => {
            const filtered = allBookings.filter(b => b.status === 'confirmed' && (selectedEventIds.size === 0 || events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle)));
            const emails = [...new Set(filtered.map(b => b.email))].join('; ');
            navigator.clipboard.writeText(emails).then(() => alert(`Copied ${filtered.length} email(s) to clipboard`)).catch(() => alert('Failed to copy'));
          }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            📋 Copy All Emails
          </button>
          {allBookings.some(b => b.promotedFromWaitlist && b.status === 'confirmed') && (
            <button onClick={() => {
              const promoted = allBookings.filter(b => b.promotedFromWaitlist && b.status === 'confirmed' && (selectedEventIds.size === 0 || events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle)));
              const emails = [...new Set(promoted.map(b => b.email))].join('; ');
              navigator.clipboard.writeText(emails).then(() => alert(`Copied ${promoted.length} promoted attendee email(s) to clipboard`)).catch(() => alert('Failed to copy'));
            }} className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">
              📋 Copy Promoted Emails
            </button>
          )}
        </div>

        {showAttendees && allBookings.length > 0 && (
          <div className="mb-6">
            {(() => {
              const filtered = allBookings.filter(b => (selectedEventIds.size === 0 || events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle))).filter(b => !hideCancelled || b.status !== 'cancelled');
              const dates = [...new Set(filtered.map(b => b.sessionDate))].sort();
              return dates.map(date => {
                const dateBookings = filtered.filter(b => b.sessionDate === date);
                return (
                  <div key={date} className="mb-4">
                    <div className="bg-gray-100 px-3 py-2 rounded-t-lg border border-gray-200 border-b-0">
                      <h4 className="font-semibold text-gray-800 text-sm">{formatDateLabel(date)} — {dateBookings.length} attendee{dateBookings.length !== 1 ? 's' : ''}</h4>
                    </div>
                    <div className="border border-gray-200 rounded-b-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Name</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Email</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">VP Alias</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Level</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Tenure</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Time</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Status</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dateBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => (
                            <tr key={b.id} className={`border-b border-gray-100 last:border-0 ${b.status === 'cancelled' ? 'opacity-50' : b.isWaitlisted ? 'bg-amber-50' : b.promotedFromWaitlist ? 'bg-purple-50' : ''}`}>
                              <td className={`px-3 py-2 ${b.status === 'cancelled' ? 'line-through text-gray-400' : ''}`}>{b.name}</td>
                              <td className="px-3 py-2 text-blue-600"><a href={`mailto:${b.email}`}>{b.email}</a></td>
                              <td className="px-3 py-2 text-gray-600">{b.vpAlias || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{b.level || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{b.tenure || '—'}</td>
                              <td className="px-3 py-2">{b.startTime.slice(0, 5)}</td>
                              <td className="px-3 py-2">
                                {b.status === 'cancelled' && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">cancelled</span>}
                                {b.isWaitlisted && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">waitlisted</span>}
                                {b.promotedFromWaitlist && b.status !== 'cancelled' && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">promoted</span>}
                                {!b.isWaitlisted && !b.promotedFromWaitlist && b.status === 'confirmed' && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">confirmed</span>}
                              </td>
                              <td className="px-3 py-2">
                                {b.status !== 'cancelled' && (
                                  <button onClick={async () => {
                                    if (!confirm(`Remove ${b.name} (${b.email}) from this ${b.isWaitlisted ? 'waitlist' : 'session'}?`)) return;
                                    setAllBookings(prev => prev.filter(x => x.id !== b.id));
                                    await fetch(`/api/admin/bookings/${b.id}`, { method: 'DELETE' });
                                    // Re-fetch to see updated state (waitlist promotions, etc.)
                                    const [bookingsRes, sessionsRes] = await Promise.all([
                                      fetch('/api/admin/bookings', { cache: 'no-store' }),
                                      fetch('/api/sessions', { cache: 'no-store' }),
                                    ]);
                                    if (bookingsRes.ok) {
                                      const fresh: AdminBooking[] = await bookingsRes.json();
                                      const eventTitles = new Set(events.filter(ev => ev.programId === programId).map(ev => ev.title));
                                      setAllBookings(fresh.filter(fb => eventTitles.has(fb.eventTitle)));
                                    }
                                    if (sessionsRes.ok) {
                                      const freshSessions: Session[] = await sessionsRes.json();
                                      const programEventIds = new Set(events.map(e => e.id));
                                      const refreshed = freshSessions.filter(s => programEventIds.has(s.eventId));
                                      // Exclude weekend sessions from display
                                      setAllSessions(refreshed.filter(s => {
                                        const d = new Date(s.sessionDate + 'T00:00:00Z');
                                        const day = d.getUTCDay();
                                        return day !== 0 && day !== 6;
                                      }));
                                    }
                                  }} className="px-2 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700">Remove</button>
                                )}
                                {b.status === 'cancelled' && (
                                  <button onClick={async () => {
                                    if (!confirm(`Permanently delete cancelled booking for ${b.name} (${b.email})?`)) return;
                                    setAllBookings(prev => prev.filter(x => x.id !== b.id));
                                    await fetch(`/api/admin/bookings/${b.id}`, { method: 'DELETE' });
                                  }} className="px-2 py-0.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">Delete</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Date breakdown */}
        {allDates.length === 0 && <p className="text-gray-500 text-sm">No events found for this program.</p>}
        {allDates.map(date => {
          const daySessions = sessionsByDate.get(date) || [];
          const dayBooked = daySessions.reduce((sum, s) => sum + s.bookingCount, 0);
          const dayCapacity = daySessions.reduce((sum, s) => sum + (s.maxAttendees || maxAtt), 0);
          const dayUtil = dayCapacity > 0 ? Math.round((dayBooked / dayCapacity) * 100) : 0;

          return (
            <section key={date} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">{formatDateLabel(date)}</h2>
                <span className="text-sm text-gray-500">{dayBooked}/{dayCapacity} booked ({dayUtil}%)</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Time</th>
                      {events.length >= 1 && <th className="text-left px-3 py-2 font-medium text-gray-700">Event</th>}
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Bookings</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daySessions.map(s => {
                      const sMax = s.maxAttendees || maxAtt;
                      const badge = getBadge(s.bookingCount, sMax);
                      const event = events.find(e => e.id === s.eventId);
                      return (
                        <tr key={s.id} className={`border-b border-gray-100 last:border-0 ${getRowColor(s.bookingCount, sMax)}`}>
                          <td className="px-3 py-2 font-medium text-gray-900">{formatTime(s.startTime)}</td>
                          {events.length >= 1 && <td className="px-3 py-2 text-gray-600 text-xs">{event?.title ?? '—'}</td>}
                          <td className="px-3 py-2 text-gray-700">{s.bookingCount}/{sMax}</td>
                          <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.bg}`}>{badge.label}</span></td>
                          <td className="px-3 py-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div className={`h-2 rounded-full ${s.bookingCount >= sMax ? 'bg-red-400' : s.bookingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.round((s.bookingCount / sMax) * 100)}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      <div className="text-xs mt-0.5 opacity-75">{sub}</div>
    </div>
  );
}
