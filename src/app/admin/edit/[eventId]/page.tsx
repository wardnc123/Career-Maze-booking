'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import type { CareerMazeEvent } from '@/models/types';

const ALL_TIME_SLOTS = [
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00',
];

type PageState = 'loading' | 'form' | 'saving' | 'saved' | 'not-found' | 'error';

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export default function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const [eventId, setEventId] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [dayOverrides, setDayOverrides] = useState<Record<string, Set<string>>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [rooms, setRooms] = useState<Array<{ building: string; room: string }>>([]);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [resultMessage, setResultMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load event data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { eventId: id } = await params;
      if (cancelled) return;
      setEventId(id);

      try {
        const res = await fetch(`/api/admin/setup/${id}`);
        if (res.status === 404) { setPageState('not-found'); return; }
        if (!res.ok) { setPageState('error'); return; }
        const event: CareerMazeEvent = await res.json();
        if (cancelled) return;

        setTitle(event.title);
        setSelectedSlots(new Set(event.timeSlots));
        setRooms(event.rooms || []);
        if (event.dates.length > 0) {
          setStartDate(event.dates[0]);
          setEndDate(event.dates[event.dates.length - 1]);
        }

        // Load existing per-day overrides from sessions
        // We detect overrides by checking if some dates have different slots
        // For now, load the global slots — user can customize from the UI
        setPageState('form');
      } catch {
        if (!cancelled) setPageState('error');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params]);

  const toggleSlot = useCallback((slot: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }, []);

  const selectMorning = useCallback(() => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      ALL_TIME_SLOTS.filter((t) => t < '12:00').forEach((t) => next.add(t));
      return next;
    });
  }, []);

  const selectAfternoon = useCallback(() => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      ALL_TIME_SLOTS.filter((t) => t >= '12:00').forEach((t) => next.add(t));
      return next;
    });
  }, []);

  const clearSlots = useCallback(() => setSelectedSlots(new Set()), []);

  // Per-day override helpers
  const toggleDayExpanded = useCallback((date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }, []);

  const enableDayOverride = useCallback((date: string) => {
    setDayOverrides((prev) => {
      if (prev[date]) return prev;
      // Initialize with the current global slots
      return { ...prev, [date]: new Set(selectedSlots) };
    });
  }, [selectedSlots]);

  const disableDayOverride = useCallback((date: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }, []);

  const toggleDayOverrideSlot = useCallback((date: string, slot: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      const daySlots = new Set(next[date] || []);
      if (daySlots.has(slot)) daySlots.delete(slot); else daySlots.add(slot);
      next[date] = daySlots;
      return next;
    });
  }, []);

  const selectDayMorning = useCallback((date: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      const daySlots = new Set(next[date] || []);
      ALL_TIME_SLOTS.filter((t) => t < '12:00').forEach((t) => daySlots.add(t));
      next[date] = daySlots;
      return next;
    });
  }, []);

  const selectDayAfternoon = useCallback((date: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      const daySlots = new Set(next[date] || []);
      ALL_TIME_SLOTS.filter((t) => t >= '12:00').forEach((t) => daySlots.add(t));
      next[date] = daySlots;
      return next;
    });
  }, []);

  const clearDaySlots = useCallback((date: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      next[date] = new Set();
      return next;
    });
  }, []);

  const previewDates = startDate && endDate && startDate <= endDate ? getDatesInRange(startDate, endDate) : [];

  // Calculate total sessions considering overrides
  const totalSessions = previewDates.reduce((sum, date) => {
    if (dayOverrides[date]) {
      return sum + dayOverrides[date].size;
    }
    return sum + selectedSlots.size;
  }, 0);

  async function handleSave() {
    if (!title.trim()) { setErrorMessage('Title is required.'); return; }
    if (!startDate || !endDate) { setErrorMessage('Please select dates.'); return; }
    if (startDate > endDate) { setErrorMessage('End date must be after start date.'); return; }
    if (selectedSlots.size === 0) { setErrorMessage('Select at least one global time slot.'); return; }

    // Check that days with overrides have at least one slot
    for (const [date, slots] of Object.entries(dayOverrides)) {
      if (slots.size === 0) {
        setErrorMessage(`Day ${formatDateLabel(date)} has a custom override with no slots selected. Either select slots or remove the override.`);
        return;
      }
    }

    setPageState('saving');
    setErrorMessage('');

    // Build slotsPerDate from dayOverrides
    let slotsPerDate: Record<string, string[]> | undefined;
    if (Object.keys(dayOverrides).length > 0) {
      slotsPerDate = {};
      for (const [date, slots] of Object.entries(dayOverrides)) {
        if (slots.size > 0) {
          slotsPerDate[date] = [...slots].sort();
        }
      }
      if (Object.keys(slotsPerDate).length === 0) slotsPerDate = undefined;
    }

    try {
      const res = await fetch(`/api/admin/setup/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          dates: getDatesInRange(startDate, endDate),
          timeSlots: [...selectedSlots].sort(),
          rooms,
          ...(slotsPerDate ? { slotsPerDate } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResultMessage(`Updated. ${data.sessionsAdded} sessions added, ${data.sessionsRemoved} removed.`);
        setPageState('saved');
      } else {
        setErrorMessage(data.error || 'Failed to update.');
        setPageState('form');
      }
    } catch {
      setErrorMessage('Network error.');
      setPageState('form');
    }
  }

  if (pageState === 'loading') {
    return <main className="min-h-screen flex items-center justify-center bg-white"><p className="text-gray-600">Loading event…</p></main>;
  }
  if (pageState === 'not-found') {
    return <main className="min-h-screen flex items-center justify-center bg-white"><div className="text-center"><p className="text-red-600 mb-4">Event not found</p><a href="/admin" className="text-blue-600 hover:underline">← Back to admin</a></div></main>;
  }

  if (pageState === 'saved') {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-emerald-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Event Updated</h2>
          <p className="text-gray-600 mb-6">{resultMessage}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/admin" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">Back to Admin Overview</a>
            <button onClick={() => setPageState('form')} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Continue Editing</button>
          </div>
        </div>
      </main>
    );
  }

  const isSaving = pageState === 'saving';

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-900">Edit Event</h2>
          <a href="/admin" className="text-sm text-blue-600 hover:underline">← Back to admin</a>
        </div>
        <p className="text-sm text-gray-500 mb-6">Changes to dates or time slots will add/remove sessions. Existing sessions with bookings are preserved.</p>

        {errorMessage && <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">{errorMessage}</div>}

        {/* Title */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Title</h3>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </section>

        {/* Meeting Location */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Meeting Location</h3>
          <p className="text-sm text-gray-500 mb-3">Where do you want the attendees to meet?</p>
          {rooms.map((room, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Building</label>
                <input type="text" value={room.building} onChange={(e) => setRooms(prev => prev.map((r, i) => i === idx ? { ...r, building: e.target.value } : r))} placeholder="e.g. LHR16" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Room</label>
                <input type="text" value={room.room} onChange={(e) => setRooms(prev => prev.map((r, i) => i === idx ? { ...r, room: e.target.value } : r))} placeholder="e.g. 01.501" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => setRooms(prev => prev.filter((_, i) => i !== idx))} className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded">Remove</button>
            </div>
          ))}
          <button onClick={() => setRooms(prev => [...prev, { building: '', room: '' }])} className="mt-2 px-3 py-1.5 text-sm font-medium bg-gray-100 rounded hover:bg-gray-200 transition-colors">+ Add Room</button>
        </section>

        {/* Dates */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Dates</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {previewDates.length > 0 && <p className="mt-2 text-sm text-gray-500">{previewDates.length} days</p>}
        </section>

        {/* Global Time Slots */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Default Time Slots</h3>
          <p className="text-sm text-gray-500 mb-3">These slots apply to all days unless you customize a specific day below.</p>
          <div className="flex gap-2 mb-3">
            <button onClick={selectMorning} className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200">Morning</button>
            <button onClick={selectAfternoon} className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200">Afternoon</button>
            <button onClick={clearSlots} className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200">Clear</button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {ALL_TIME_SLOTS.map((slot) => (
              <button key={slot} onClick={() => toggleSlot(slot)} className={`px-2 py-2 rounded border text-sm font-medium transition-colors ${selectedSlots.has(slot) ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{slot}</button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">{selectedSlots.size} slots selected (default)</p>
        </section>

        {/* Per-Day Overrides */}
        {previewDates.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Per-Day Customization</h3>
            <p className="text-sm text-gray-500 mb-3">
              Click &quot;Customize&quot; on any day to set different time slots for that specific day.
              Days without customization use the default slots above.
            </p>
            <div className="space-y-2">
              {previewDates.map((date) => {
                const hasOverride = !!dayOverrides[date];
                const isExpanded = expandedDays.has(date);
                const daySlotCount = hasOverride ? dayOverrides[date].size : selectedSlots.size;

                return (
                  <div key={date} className={`border rounded-lg ${hasOverride ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
                    {/* Day header */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleDayExpanded(date)} className="text-gray-500 hover:text-gray-700" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                          <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
                        </button>
                        <div>
                          <span className="text-sm font-medium text-gray-800">{formatDateLabel(date)}</span>
                          <span className="ml-2 text-xs text-gray-500">({daySlotCount} slots)</span>
                        </div>
                        {hasOverride && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">Custom</span>}
                      </div>
                      <div>
                        {!hasOverride ? (
                          <button
                            onClick={() => { enableDayOverride(date); setExpandedDays(prev => new Set([...prev, date])); }}
                            className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                          >
                            Customize
                          </button>
                        ) : (
                          <button
                            onClick={() => { disableDayOverride(date); setExpandedDays(prev => { const n = new Set(prev); n.delete(date); return n; }); }}
                            className="text-xs px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium"
                          >
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded slot grid */}
                    {isExpanded && hasOverride && (
                      <div className="px-4 pb-4 border-t border-amber-200 pt-3">
                        <div className="flex gap-2 mb-3">
                          <button onClick={() => selectDayMorning(date)} className="px-2 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50">Morning</button>
                          <button onClick={() => selectDayAfternoon(date)} className="px-2 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50">Afternoon</button>
                          <button onClick={() => clearDaySlots(date)} className="px-2 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50">Clear</button>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                          {ALL_TIME_SLOTS.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => toggleDayOverrideSlot(date, slot)}
                              className={`px-1.5 py-1.5 rounded border text-xs font-medium transition-colors ${dayOverrides[date]?.has(slot) ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-amber-700">{dayOverrides[date]?.size || 0} custom slots for this day</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Summary */}
        <section className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Summary</h3>
          <div className="text-sm text-gray-700 space-y-1">
            <p>Event: {title || '—'}</p>
            <p>Days: {previewDates.length || '—'}</p>
            <p>Default slots per day: {selectedSlots.size || '—'}</p>
            {Object.keys(dayOverrides).length > 0 && (
              <p>Days with custom slots: {Object.keys(dayOverrides).length}</p>
            )}
            <p className="font-medium">Total sessions: {totalSessions || '—'}</p>
          </div>
        </section>

        <button onClick={handleSave} disabled={isSaving} className="w-full py-3 px-4 bg-[#1a1a2e] text-white rounded-lg font-medium hover:bg-[#2a2a4e] disabled:opacity-50 transition-colors text-lg">
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="bg-[#1a1a2e] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
        <Image src="/career-maze-logo.jpg" alt="Career Maze logo" width={80} height={80} className="rounded-lg" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Edit Event</h1>
          <p className="mt-1 text-sm text-gray-300">Update event details</p>
        </div>
      </div>
    </div>
  );
}
