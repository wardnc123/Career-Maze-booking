'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

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

type PageState = 'form' | 'submitting' | 'success' | 'error';

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  while (current <= endDate) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
      dates.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export default function AdminSetupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-white"><p className="text-gray-600">Loading…</p></main>}>
      <AdminSetupContent />
    </Suspense>
  );
}

function AdminSetupContent() {
  const searchParams = useSearchParams();
  const programId = searchParams.get('programId') || 'default-career-maze';
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('Europe/London');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [slotMode, setSlotMode] = useState<'quick' | 'custom'>('quick');
  const [customRanges, setCustomRanges] = useState<Array<{ start: string; end: string }>>([]);
  const [dayOverrides, setDayOverrides] = useState<Record<string, Set<string>>>({});
  const [dayCustomRangeOverrides, setDayCustomRangeOverrides] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [maxAttendees, setMaxAttendees] = useState(3);
  const [allowMultiSlot, setAllowMultiSlot] = useState(false);
  const [rooms, setRooms] = useState<Array<{ building: string; room: string }>>([]);
  const [pageState, setPageState] = useState<PageState>('form');
  const [resultMessage, setResultMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  const toggleDayOverrideSlot = useCallback((date: string, slot: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      const daySlots = new Set(next[date] || []);
      if (daySlots.has(slot)) daySlots.delete(slot); else daySlots.add(slot);
      next[date] = daySlots;
      return next;
    });
  }, []);

  const enableDayOverride = useCallback((date: string) => {
    setDayOverrides((prev) => ({ ...prev, [date]: new Set(selectedSlots) }));
    setExpandedDays((prev) => { const next = new Set(prev); next.add(date); return next; });
  }, [selectedSlots]);

  const removeDayOverride = useCallback((date: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    setExpandedDays((prev) => { const next = new Set(prev); next.delete(date); return next; });
  }, []);

  const toggleDayExpanded = useCallback((date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }, []);

  function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  }

  const previewDates = startDate && endDate && startDate <= endDate ? getDatesInRange(startDate, endDate) : [];

  async function handleCreate() {
    if (!title.trim()) { setErrorMessage('Please enter an event title.'); return; }
    if (!startDate || !endDate) { setErrorMessage('Please select a start and end date.'); return; }
    if (startDate > endDate) { setErrorMessage('End date must be after start date.'); return; }

    // Determine time slots based on mode
    let timeSlots: string[];
    if (slotMode === 'quick') {
      if (selectedSlots.size === 0) { setErrorMessage('Please select at least one time slot.'); return; }
      timeSlots = [...selectedSlots].sort();
    } else {
      if (customRanges.length === 0) { setErrorMessage('Please add at least one custom time range.'); return; }
      const invalid = customRanges.find(r => !r.start || !r.end || r.start >= r.end);
      if (invalid) { setErrorMessage('Each custom range must have a start time before the end time.'); return; }
      // Use start times as the time slots (duration is derived from the range)
      timeSlots = customRanges.map(r => r.start).sort();
    }

    setPageState('submitting');
    setErrorMessage('');

    // Build slotsPerDate from dayOverrides (quick mode) or dayCustomRangeOverrides (custom mode)
    let slotsPerDate: Record<string, string[]> | undefined;
    if (slotMode === 'quick' && Object.keys(dayOverrides).length > 0) {
      slotsPerDate = {};
      for (const [date, slots] of Object.entries(dayOverrides)) {
        if (slots.size > 0) {
          slotsPerDate[date] = [...slots].sort();
        }
      }
      if (Object.keys(slotsPerDate).length === 0) slotsPerDate = undefined;
    } else if (slotMode === 'custom' && Object.keys(dayCustomRangeOverrides).length > 0) {
      slotsPerDate = {};
      for (const [date, ranges] of Object.entries(dayCustomRangeOverrides)) {
        const validRanges = ranges.filter(r => r.start && r.end);
        if (validRanges.length > 0) {
          slotsPerDate[date] = validRanges.map(r => r.start).sort();
        }
      }
      if (Object.keys(slotsPerDate).length === 0) slotsPerDate = undefined;
    }

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), location: location.trim(), timezone, dates: getDatesInRange(startDate, endDate), timeSlots, programId, maxAttendees, allowMultiSlot, rooms: rooms.filter(r => r.building.trim() || r.room.trim()), ...(slotsPerDate ? { slotsPerDate } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        setResultMessage(`"${title.trim()}" created with ${data.totalSessions} sessions.`);
        setPageState('success');
      } else {
        setErrorMessage(data.detail ? `${data.error}: ${data.detail}` : (data.error || 'Failed to create event.'));
        setPageState('error');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
      setPageState('error');
    }
  }

  if (pageState === 'success') {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-emerald-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Event Created</h2>
          <p className="text-gray-600 mb-6">{resultMessage}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href={programId !== 'default-career-maze' ? `/admin/programs/${programId}` : '/admin'} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">View Admin Overview</a>
            <button onClick={() => { setPageState('form'); setTitle(''); setLocation(''); setTimezone('Europe/London'); setStartDate(''); setEndDate(''); clearSlots(); setDayOverrides({}); setDayCustomRangeOverrides({}); setExpandedDays(new Set()); setAllowMultiSlot(false); setRooms([]); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Create Another</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Create New Event</h2>
        <p className="text-sm text-gray-500 mb-6">Set up a new Career Maze booking event with its own dates and time slots.</p>

        {errorMessage && <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">{errorMessage}</div>}

        {/* Title */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">1. Event title</h3>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Career Maze London - August 2026" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </section>

        {/* Location */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">2. Location</h3>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Building 1, Floor 3, Room 301, Amazon LDN" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </section>

        {/* Timezone */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">3. Timezone</h3>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full sm:w-auto border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Europe/London">🇬🇧 UK (Europe/London)</option>
            <option value="Europe/Berlin">🇩🇪 Germany (Europe/Berlin)</option>
            <option value="Europe/Paris">🇫🇷 France (Europe/Paris)</option>
            <option value="Europe/Madrid">🇪🇸 Spain (Europe/Madrid)</option>
            <option value="Europe/Rome">🇮🇹 Italy (Europe/Rome)</option>
            <option value="America/New_York">🇺🇸 US East (America/New_York)</option>
            <option value="America/Chicago">🇺🇸 US Central (America/Chicago)</option>
            <option value="America/Denver">🇺🇸 US Mountain (America/Denver)</option>
            <option value="America/Los_Angeles">🇺🇸 US West (America/Los_Angeles)</option>
            <option value="America/Sao_Paulo">🇧🇷 Brazil (America/Sao_Paulo)</option>
            <option value="Asia/Dubai">🇦🇪 UAE (Asia/Dubai)</option>
            <option value="Asia/Kolkata">🇮🇳 India (Asia/Kolkata)</option>
            <option value="Asia/Singapore">🇸🇬 Singapore (Asia/Singapore)</option>
            <option value="Asia/Tokyo">🇯🇵 Japan (Asia/Tokyo)</option>
            <option value="Asia/Shanghai">🇨🇳 China (Asia/Shanghai)</option>
            <option value="Australia/Sydney">🇦🇺 Australia (Australia/Sydney)</option>
          </select>
        </section>

        {/* Dates */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">4. Choose dates</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
              <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">End date</label>
              <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {previewDates.length > 0 && <p className="mt-2 text-sm text-gray-500">{previewDates.length} days selected</p>}
        </section>

        {/* Time slots */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">5. Choose time slots</h3>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSlotMode('quick')}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${slotMode === 'quick' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Quick Slots (15-min grid)
            </button>
            <button
              onClick={() => setSlotMode('custom')}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${slotMode === 'custom' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Custom Ranges
            </button>
          </div>

          {slotMode === 'quick' && (
            <>
              <div className="flex gap-2 mb-3">
                <button onClick={selectMorning} className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200">Select Morning</button>
                <button onClick={selectAfternoon} className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200">Select Afternoon</button>
                <button onClick={clearSlots} className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200">Clear All</button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {ALL_TIME_SLOTS.map((slot) => (
                  <button key={slot} onClick={() => toggleSlot(slot)} className={`px-2 py-2 rounded border text-sm font-medium transition-colors ${selectedSlots.has(slot) ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{slot}</button>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">{selectedSlots.size} time slots selected</p>
            </>
          )}

          {slotMode === 'custom' && (
            <>
              <p className="text-sm text-gray-500 mb-3">Define custom time ranges. Each range becomes a bookable session slot.</p>
              {customRanges.map((range, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500 w-16">Slot {idx + 1}:</span>
                  <input
                    type="time"
                    value={range.start}
                    onChange={(e) => setCustomRanges(prev => prev.map((r, i) => i === idx ? { ...r, start: e.target.value } : r))}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={range.end}
                    onChange={(e) => setCustomRanges(prev => prev.map((r, i) => i === idx ? { ...r, end: e.target.value } : r))}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {range.start && range.end && range.start < range.end && (
                    <span className="text-xs text-gray-400">
                      ({Math.round((new Date(`2000-01-01T${range.end}`).getTime() - new Date(`2000-01-01T${range.start}`).getTime()) / 60000)} min)
                    </span>
                  )}
                  <button
                    onClick={() => setCustomRanges(prev => prev.filter((_, i) => i !== idx))}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCustomRanges(prev => [...prev, { start: '', end: '' }])}
                className="mt-2 px-3 py-1.5 text-sm font-medium bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                + Add Slot
              </button>
              <p className="mt-2 text-sm text-gray-500">{customRanges.length} custom slot{customRanges.length !== 1 ? 's' : ''} defined</p>
            </>
          )}
        </section>

        {/* Day Exceptions — when dates and default slots are selected */}
        {previewDates.length > 0 && ((slotMode === 'quick' && selectedSlots.size > 0) || (slotMode === 'custom' && customRanges.length > 0)) && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Day Exceptions</h3>
            <p className="text-sm text-gray-500 mb-3">Customize time slots for specific days. Days without exceptions use the default slots above.</p>
            <div className="space-y-2">
              {previewDates.map((date) => {
                const hasQuickOverride = slotMode === 'quick' && date in dayOverrides;
                const hasCustomOverride = slotMode === 'custom' && date in dayCustomRangeOverrides;
                const hasOverride = hasQuickOverride || hasCustomOverride;
                const isExpanded = expandedDays.has(date);
                const overrideSlots = dayOverrides[date];
                const overrideRanges = dayCustomRangeOverrides[date];
                const defaultCount = slotMode === 'quick' ? selectedSlots.size : customRanges.length;
                const overrideCount2 = hasQuickOverride ? overrideSlots.size : hasCustomOverride ? overrideRanges.length : 0;
                return (
                  <div key={date} className={`border rounded-lg ${hasOverride ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{formatDateLabel(date)}</span>
                        {hasOverride ? (
                          <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Custom ({overrideCount2} slot{overrideCount2 !== 1 ? 's' : ''})</span>
                        ) : (
                          <span className="text-xs text-gray-500">Using default ({defaultCount} slots)</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {hasOverride ? (
                          <>
                            <button onClick={() => toggleDayExpanded(date)} className="px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded transition-colors">
                              {isExpanded ? 'Collapse' : 'Edit'}
                            </button>
                            <button onClick={() => {
                              if (slotMode === 'quick') removeDayOverride(date);
                              else {
                                setDayCustomRangeOverrides(prev => { const n = { ...prev }; delete n[date]; return n; });
                                setExpandedDays(prev => { const n = new Set(prev); n.delete(date); return n; });
                              }
                            }} className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors">
                              Reset to default
                            </button>
                          </>
                        ) : (
                          <button onClick={() => {
                            if (slotMode === 'quick') enableDayOverride(date);
                            else {
                              setDayCustomRangeOverrides(prev => ({ ...prev, [date]: customRanges.map(r => ({ ...r })) }));
                              setExpandedDays(prev => { const n = new Set(prev); n.add(date); return n; });
                            }
                          }} className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            Customize
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Quick slots grid for this day */}
                    {hasQuickOverride && isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-amber-200">
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                          {ALL_TIME_SLOTS.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => toggleDayOverrideSlot(date, slot)}
                              className={`px-1.5 py-1.5 rounded border text-xs font-medium transition-colors ${overrideSlots.has(slot) ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-amber-700">{overrideSlots.size} slot{overrideSlots.size !== 1 ? 's' : ''} selected for {formatDateLabel(date)}</p>
                      </div>
                    )}
                    {/* Custom ranges editor for this day */}
                    {hasCustomOverride && isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-amber-200">
                        {overrideRanges.map((range, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500 w-14">Slot {idx + 1}:</span>
                            <input type="time" value={range.start} onChange={(e) => setDayCustomRangeOverrides(prev => {
                              const n = { ...prev }; n[date] = [...n[date]]; n[date][idx] = { ...n[date][idx], start: e.target.value }; return n;
                            })} className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <span className="text-gray-400 text-xs">to</span>
                            <input type="time" value={range.end} onChange={(e) => setDayCustomRangeOverrides(prev => {
                              const n = { ...prev }; n[date] = [...n[date]]; n[date][idx] = { ...n[date][idx], end: e.target.value }; return n;
                            })} className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => setDayCustomRangeOverrides(prev => {
                              const n = { ...prev }; n[date] = n[date].filter((_, i) => i !== idx); return n;
                            })} className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded">Remove</button>
                          </div>
                        ))}
                        <button onClick={() => setDayCustomRangeOverrides(prev => {
                          const n = { ...prev }; n[date] = [...(n[date] || []), { start: '', end: '' }]; return n;
                        })} className="px-2 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200">+ Add Slot</button>
                        <p className="mt-1.5 text-xs text-amber-700">{overrideRanges.length} slot{overrideRanges.length !== 1 ? 's' : ''} for {formatDateLabel(date)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(Object.keys(dayOverrides).length + Object.keys(dayCustomRangeOverrides).length) > 0 && (
              <p className="mt-2 text-sm text-amber-700">{Object.keys(dayOverrides).length + Object.keys(dayCustomRangeOverrides).length} day{(Object.keys(dayOverrides).length + Object.keys(dayCustomRangeOverrides).length) !== 1 ? 's' : ''} with custom slots</p>
            )}
          </section>
        )}

        {/* Max Attendees */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">6. Max attendees per session</h3>
          <input
            type="number"
            min="1"
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(Math.max(1, Number(e.target.value)))}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
          />
          <p className="text-xs text-gray-500 mt-1">How many people can book each time slot before it becomes full.</p>
        </section>

        {/* Meeting Location (Rooms) */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Where do you want the attendees to meet?</h3>
          <p className="text-sm text-gray-500 mb-3">Add building and room details. You can add multiple rooms.</p>
          {rooms.map((room, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Building</label>
                <input type="text" value={room.building} onChange={(e) => setRooms(prev => prev.map((r, i) => i === idx ? { ...r, building: e.target.value } : r))} placeholder="e.g. LHR16" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Room</label>
                <input type="text" value={room.room} onChange={(e) => setRooms(prev => prev.map((r, i) => i === idx ? { ...r, room: e.target.value } : r))} placeholder="e.g. 01.501" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => setRooms(prev => prev.filter((_, i) => i !== idx))} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200">Remove</button>
            </div>
          ))}
          <button onClick={() => setRooms(prev => [...prev, { building: '', room: '' }])} className="mt-2 px-3 py-1.5 text-sm font-medium bg-gray-100 rounded hover:bg-gray-200 transition-colors">+ Add Room</button>
        </section>

        {/* Allow Multi-Slot */}
        <section className="mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMultiSlot}
              onChange={(e) => setAllowMultiSlot(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Allow attendees to sign up to more than 1 slot
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">When enabled, users can select multiple time slots before booking.</p>
        </section>

        {/* Summary */}
        <section className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Summary</h3>
          <div className="text-sm text-gray-700 space-y-1">
            <p>Event: {title || '—'}</p>
            <p>Location: {location || '—'}</p>
            <p>Timezone: {timezone}</p>
            <p>Days: {previewDates.length || '—'}</p>
            <p>Default slots per day: {slotMode === 'quick' ? (selectedSlots.size || '—') : (customRanges.length || '—')}</p>
            {(Object.keys(dayOverrides).length + Object.keys(dayCustomRangeOverrides).length) > 0 && (
              <p className="text-amber-700">Days with custom slots: {Object.keys(dayOverrides).length + Object.keys(dayCustomRangeOverrides).length}</p>
            )}
            <p>Total sessions: {(() => {
              if (slotMode === 'quick') {
                let total = 0;
                for (const date of previewDates) {
                  total += (dayOverrides[date]?.size ?? selectedSlots.size);
                }
                return total || '—';
              }
              let total = 0;
              for (const date of previewDates) {
                total += (dayCustomRangeOverrides[date]?.filter(r => r.start && r.end).length ?? customRanges.length);
              }
              return total || '—';
            })()}</p>
            {slotMode === 'custom' && customRanges.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="font-medium">Custom slots:</p>
                {customRanges.filter(r => r.start && r.end).map((r, i) => (
                  <p key={i} className="text-gray-500">  {r.start} – {r.end}</p>
                ))}
              </div>
            )}
          </div>
        </section>

        <button onClick={handleCreate} disabled={pageState === 'submitting'} className="w-full py-3 px-4 bg-[#1a1a2e] text-white rounded-lg font-medium hover:bg-[#2a2a4e] disabled:opacity-50 transition-colors text-lg">
          {pageState === 'submitting' ? 'Creating…' : 'Create Event'}
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
          <h1 className="text-2xl sm:text-3xl font-bold">Event Setup</h1>
          <p className="mt-1 text-sm text-gray-300">Create a new Career Maze booking event</p>
        </div>
      </div>
    </div>
  );
}
