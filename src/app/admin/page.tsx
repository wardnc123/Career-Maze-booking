'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import type { Session, CareerMazeEvent } from '@/models/types';

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function getBadge(count: number): { bg: string; label: string } {
  if (count === 0) return { bg: 'bg-emerald-100 text-emerald-800', label: 'Empty' };
  if (count < 3) return { bg: 'bg-amber-100 text-amber-800', label: `${count}/3` };
  return { bg: 'bg-red-100 text-red-800', label: 'Full' };
}

function getRowColor(count: number): string {
  if (count === 0) return 'bg-emerald-50';
  if (count < 3) return 'bg-amber-50';
  return 'bg-red-50';
}

interface AdminBooking { id: string; name: string; email: string; role: string; pf: string; status: string; referenceCode: string; sessionDate: string; startTime: string; eventTitle: string; eventLocation: string; }

export default function AdminOverviewPage() {
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<CareerMazeEvent[]>([]);
  const [allBookings, setAllBookings] = useState<AdminBooking[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showAttendees, setShowAttendees] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch events, sessions, and bookings
  useEffect(() => {
    Promise.all([
      fetch('/api/sessions', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/admin/setup', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/admin/bookings', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([sessionsData, eventsData, bookingsData]) => {
      setAllSessions(sessionsData);
      setEvents(eventsData);
      setAllBookings(bookingsData);
      // Select all events by default
      setSelectedEventIds(new Set(eventsData.map((e: CareerMazeEvent) => e.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('session:updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        setAllSessions((prev) => prev.map((s) => s.id === data.sessionId ? { ...s, bookingCount: data.bookingCount, slotStatus: data.slotStatus } : s));
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, []);

  // Filter sessions by selected events
  const sessions = useMemo(() => {
    if (selectedEventIds.size === 0) return allSessions;
    return allSessions.filter((s) => selectedEventIds.has(s.eventId));
  }, [allSessions, selectedEventIds]);

  // Stats
  const stats = useMemo(() => {
    const total = sessions.length;
    const totalBooked = sessions.reduce((sum, s) => sum + s.bookingCount, 0);
    const totalCapacity = total * 3;
    const full = sessions.filter((s) => s.bookingCount >= 3).length;
    const empty = sessions.filter((s) => s.bookingCount === 0).length;
    const partial = total - full - empty;
    const utilisation = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;
    return { total, totalBooked, totalCapacity, full, empty, partial, utilisation };
  }, [sessions]);

  // Group by date
  const allDates = useMemo(() => [...new Set(sessions.map((s) => s.sessionDate))].sort(), [sessions]);
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const date of allDates) {
      map.set(date, sessions.filter((s) => s.sessionDate === date).sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  }, [sessions, allDates]);

  function toggleEvent(eventId: string) {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }

  function selectAllEvents() { setSelectedEventIds(new Set(events.map((e) => e.id))); }
  function clearEvents() { setSelectedEventIds(new Set()); }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center bg-white"><p className="text-gray-600 text-lg">Loading overview…</p></main>;
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
          <Image src="/career-maze-logo.jpg" alt="Career Maze logo" width={80} height={80} className="rounded-lg" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin Overview</h1>
            <p className="mt-1 text-sm text-gray-300">{events.length} event{events.length !== 1 ? 's' : ''} · {stats.total} sessions</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 sm:px-6 lg:px-8 flex gap-3">
          <a href="/admin/setup" className="text-sm text-gray-300 hover:text-white transition-colors">+ Create New Event</a>
          {events.length === 1 && <a href={`/admin/edit/${events[0].id}`} className="text-sm text-gray-300 hover:text-white transition-colors">✏️ Edit Event</a>}
          <a href="/" className="text-sm text-gray-300 hover:text-white transition-colors">View Booking Page</a>
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
              {events.map((event) => {
                const isSelected = selectedEventIds.has(event.id);
                const eventSessions = allSessions.filter((s) => s.eventId === event.id);
                const booked = eventSessions.reduce((sum, s) => sum + s.bookingCount, 0);
                const capacity = eventSessions.length * 3;
                return (
                  <div key={event.id} className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left ${isSelected ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    <button onClick={() => toggleEvent(event.id)} className="w-full text-left">
                      <div className="font-medium">{event.title}</div>
                      <div className={`text-xs mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{eventSessions.length} sessions · {booked}/{capacity} booked</div>
                    </button>
                    <div className="flex gap-2 mt-1">
                      <a href={`/admin/edit/${event.id}`} className={`text-xs ${isSelected ? 'text-gray-300 hover:text-white' : 'text-blue-600 hover:underline'}`}>✏️ Edit</a>
                      <button onClick={async (e) => { e.stopPropagation(); if(!confirm(`Delete "${event.title}"?`)) return; setEvents(prev => prev.filter(ev => ev.id !== event.id)); setAllSessions(prev => prev.filter(s => s.eventId !== event.id)); setSelectedEventIds(prev => { const n = new Set(prev); n.delete(event.id); return n; }); fetch(`/api/admin/setup/${event.id}`,{method:'DELETE'}).catch(() => {}); }} className={`text-xs ${isSelected ? 'text-red-300 hover:text-red-100' : 'text-red-500 hover:underline'}`}>🗑️ Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total Bookings" value={stats.totalBooked} sub={`of ${stats.totalCapacity} capacity`} color="bg-blue-50 text-blue-800 border-blue-200" />
          <StatCard label="Utilisation" value={`${stats.utilisation}%`} sub={`${stats.full} full sessions`} color="bg-emerald-50 text-emerald-800 border-emerald-200" />
          <StatCard label="Empty Sessions" value={stats.empty} sub={`of ${stats.total} total`} color="bg-amber-50 text-amber-800 border-amber-200" />
          <StatCard label="Partially Booked" value={stats.partial} sub={`of ${stats.total} total`} color="bg-violet-50 text-violet-800 border-violet-200" />
          <StatCard label="Fully Booked" value={stats.full} sub={`of ${stats.total} total`} color="bg-red-50 text-red-800 border-red-200" />
        </div>

        {/* Attendees section */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setShowAttendees(!showAttendees)} className="px-4 py-2 bg-[#1a1a2e] text-white text-sm rounded hover:bg-[#2a2a4e]">
            {showAttendees ? 'Hide Attendees' : 'Show Attendees'}
          </button>
          <button onClick={() => {
            const filtered = allBookings.filter(b => b.status === 'confirmed' && (selectedEventIds.size === 0 || events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle)));
            const csv = 'Event,Name,Email,Role,PF,Date,Time,Status,Reference\n' + filtered.map(b => `"${b.eventTitle}","${b.name}","${b.email}","${b.role}","${b.pf}","${b.sessionDate}","${b.startTime.slice(0,5)}","${b.status}","${b.referenceCode}"`).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'career-maze-bookings.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700">
            Export CSV
          </button>
          <span className="text-sm text-gray-500">{allBookings.filter(b => b.status === 'confirmed').length} confirmed bookings</span>
        </div>

        {showAttendees && allBookings.length > 0 && (
          <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Event</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Time</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {allBookings.filter(b => selectedEventIds.size === 0 || events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle)).map(b => (
                  <tr key={b.id} className={`border-b border-gray-100 last:border-0 ${b.status === 'cancelled' ? 'bg-gray-50 text-gray-400' : ''}`}>
                    <td className="px-3 py-2 text-xs">{b.eventTitle}</td>
                    <td className="px-3 py-2">{b.name}</td>
                    <td className="px-3 py-2 text-blue-600"><a href={`mailto:${b.email}`}>{b.email}</a></td>
                    <td className="px-3 py-2">{b.sessionDate}</td>
                    <td className="px-3 py-2">{b.startTime.slice(0, 5)}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Date breakdown */}
        {allDates.length === 0 && <p className="text-gray-500 text-sm">No events selected. Use the filter above to select events.</p>}
        {allDates.map((date) => {
          const daySessions = sessionsByDate.get(date) || [];
          const dayBooked = daySessions.reduce((sum, s) => sum + s.bookingCount, 0);
          const dayCapacity = daySessions.length * 3;
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
                    {daySessions.map((s) => {
                      const badge = getBadge(s.bookingCount);
                      const event = events.find((e) => e.id === s.eventId);
                      return (
                        <tr key={s.id} className={`border-b border-gray-100 last:border-0 ${getRowColor(s.bookingCount)}`}>
                          <td className="px-3 py-2 font-medium text-gray-900">{formatTime(s.startTime)}</td>
                          {events.length >= 1 && <td className="px-3 py-2 text-gray-600 text-xs">{event?.title ?? '—'}</td>}
                          <td className="px-3 py-2 text-gray-700">{s.bookingCount}/3</td>
                          <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.bg}`}>{badge.label}</span></td>
                          <td className="px-3 py-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div className={`h-2 rounded-full ${s.bookingCount >= 3 ? 'bg-red-400' : s.bookingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.round((s.bookingCount / 3) * 100)}%` }} />
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
