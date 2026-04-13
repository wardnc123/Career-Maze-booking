'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { Program, CareerMazeEvent } from '@/models/types';

interface BookingInfo {
  id: string; name: string; email: string; role: string; pf: string;
  referenceCode: string; status: string; sessionDate?: string;
  startTime?: string; eventTitle?: string; eventLocation?: string;
  eventId?: string;
}

interface ProgramGroup {
  program: Program | null;
  bookings: BookingInfo[];
}

function formatTime(t: string) { return t ? t.slice(0, 5) : ''; }
function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function openInOutlook(b: BookingInfo, programName: string, duration: number) {
  if (!b.sessionDate || !b.startTime) return;
  const [hours, minutes] = b.startTime.split(':');
  const endMinutes = parseInt(hours) * 60 + parseInt(minutes) + duration;
  const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
  const endM = String(endMinutes % 60).padStart(2, '0');
  const subject = encodeURIComponent(`${programName} Session - ${b.name}`);
  const body = encodeURIComponent(`Ref: ${b.referenceCode}\nCancel: ${window.location.origin}/cancel`);
  const loc = encodeURIComponent(b.eventLocation || '');
  window.open(`https://outlook.office.com/calendar/0/deeplink/compose?subject=${subject}&startdt=${b.sessionDate}T${hours}:${minutes}:00&enddt=${b.sessionDate}T${endH}:${endM}:00&body=${body}&location=${loc}`, '_blank');
}

function downloadCalendar(b: BookingInfo, programName: string, duration: number) {
  if (!b.sessionDate || !b.startTime) return;
  const [year, month, day] = b.sessionDate.split('-');
  const [hours, minutes] = b.startTime.split(':');
  const dtStart = `${year}${month}${day}T${hours}${minutes}00`;
  const endMinutes = parseInt(hours) * 60 + parseInt(minutes) + duration;
  const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
  const endM = String(endMinutes % 60).padStart(2, '0');
  const dtEnd = `${year}${month}${day}T${endH}${endM}00`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BookingPlatform//Booking//EN',
    'BEGIN:VEVENT', `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
    `SUMMARY:${programName} Session - ${b.name}`,
    `DESCRIPTION:Ref: ${b.referenceCode}\\nProgram: ${programName}\\n\\nCancel: ${window.location.origin}/cancel`,
    b.eventLocation ? `LOCATION:${b.eventLocation}` : '',
    `UID:${b.id}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${programName.toLowerCase().replace(/\s+/g, '-')}-${b.referenceCode}.ics`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function MyBookingsPage() {
  const [email, setEmail] = useState('');
  const [groups, setGroups] = useState<ProgramGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function lookup() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email.'); return; }
    setLoading(true); setError('');
    try {
      // Fetch bookings, events, and programs in parallel
      const [bookingsRes, eventsRes, programsRes] = await Promise.all([
        fetch(`/api/bookings/lookup?email=${encodeURIComponent(email.trim())}`, { cache: 'no-store' }),
        fetch('/api/admin/setup', { cache: 'no-store' }),
        fetch('/api/programs', { cache: 'no-store' }),
      ]);
      if (!bookingsRes.ok) { setError('Failed to look up bookings.'); setLoading(false); return; }

      const bookings: BookingInfo[] = await bookingsRes.json();
      const events: CareerMazeEvent[] = await eventsRes.json();
      const programs: Program[] = await programsRes.json();

      if (bookings.length === 0) { setError('No bookings found for this email.'); setGroups([]); setLoading(false); return; }

      // Build event→program mapping
      const eventProgramMap = new Map<string, string>();
      for (const ev of events) {
        eventProgramMap.set(ev.id, ev.programId);
      }

      // Also map booking eventId from the enriched data
      const bookingEventMap = new Map<string, string>();
      for (const b of bookings) {
        // Find event by matching eventTitle or by session lookup
        const ev = events.find((e) => e.title === b.eventTitle);
        if (ev) bookingEventMap.set(b.id, ev.programId);
      }

      // Group bookings by program
      const programMap = new Map<string, Program>();
      for (const p of programs) programMap.set(p.id, p);

      const groupMap = new Map<string, BookingInfo[]>();
      for (const b of bookings) {
        const programId = bookingEventMap.get(b.id) || 'unknown';
        if (!groupMap.has(programId)) groupMap.set(programId, []);
        groupMap.get(programId)!.push(b);
      }

      const result: ProgramGroup[] = [];
      for (const [programId, programBookings] of groupMap) {
        result.push({
          program: programMap.get(programId) || null,
          bookings: programBookings,
        });
      }

      setGroups(result);
    } catch { setError('Network error.'); }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
          <div><h1 className="text-2xl sm:text-3xl font-bold">My Bookings</h1><p className="mt-1 text-sm text-gray-300">Look up your bookings and download calendar invites</p></div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Your email address</label>
          <div className="flex gap-2">
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lookup(); }} placeholder="Enter the email you used to book" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
            <button onClick={lookup} disabled={loading} className="px-4 py-2 bg-[#1a1a2e] text-white rounded text-sm font-medium hover:bg-[#2a2a4e] disabled:opacity-50">{loading ? 'Looking up...' : 'Find'}</button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">{error}</div>}

        {groups && groups.length > 0 && (
          <div className="space-y-6">
            {groups.map((group, gi) => {
              const prog = group.program;
              const programName = prog?.name || 'Unknown Program';
              const brandColor = prog?.brandColor || '#1a1a2e';
              const duration = prog?.sessionDurationMinutes || 180;

              return (
                <div key={gi}>
                  {/* Program group header */}
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b-2" style={{ borderColor: brandColor }}>
                    {prog?.logoUrl ? (
                      <Image src={prog.logoUrl} alt={`${programName} logo`} width={40} height={40} className="rounded" />
                    ) : (
                      <div className="w-10 h-10 rounded flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: brandColor }}>
                        {programName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h2 className="text-lg font-semibold text-gray-900">{programName}</h2>
                  </div>

                  <div className="space-y-3">
                    {group.bookings.map(b => (
                      <div key={b.id} className={`border rounded-lg p-4 ${b.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            {b.eventTitle && <p className="text-xs text-gray-500 mb-1">{b.eventTitle}</p>}
                            <p className="font-medium text-gray-900">{formatDate(b.sessionDate || '')} at {formatTime(b.startTime || '')}</p>
                            <p className="text-sm text-gray-500">Ref: {b.referenceCode}</p>
                            <p className="text-xs mt-1"><span className={`px-2 py-0.5 rounded font-medium ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.status}</span></p>
                          </div>
                          {b.status === 'confirmed' && (
                            <div className="flex flex-col gap-1">
                              <button onClick={() => openInOutlook(b, programName, duration)} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">📧 Outlook</button>
                              <button onClick={() => downloadCalendar(b, programName, duration)} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">📅 .ics</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center flex gap-4 justify-center">
          <a href="/" className="text-sm text-blue-600 hover:underline">Book a session</a>
          <a href="/cancel" className="text-sm text-red-600 hover:underline">Cancel a booking</a>
        </div>
      </div>
    </main>
  );
}
