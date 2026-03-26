'use client';

import { useState, useCallback } from 'react';
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
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export default function AdminSetupPage() {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('Europe/London');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
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

  const previewDates = startDate && endDate && startDate <= endDate ? getDatesInRange(startDate, endDate) : [];

  async function handleCreate() {
    if (!title.trim()) { setErrorMessage('Please enter an event title.'); return; }
    if (!startDate || !endDate) { setErrorMessage('Please select a start and end date.'); return; }
    if (startDate > endDate) { setErrorMessage('End date must be after start date.'); return; }
    if (selectedSlots.size === 0) { setErrorMessage('Please select at least one time slot.'); return; }

    setPageState('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), location: location.trim(), timezone, dates: getDatesInRange(startDate, endDate), timeSlots: [...selectedSlots].sort() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResultMessage(`"${title.trim()}" created with ${data.totalSessions} sessions.`);
        setPageState('success');
      } else {
        setErrorMessage(data.error || 'Failed to create event.');
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
            <a href="/admin" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">View Admin Overview</a>
            <button onClick={() => { setPageState('form'); setTitle(''); setLocation(''); setTimezone('Europe/London'); setStartDate(''); setEndDate(''); clearSlots(); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Create Another</button>
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
        </section>

        {/* Summary */}
        <section className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Summary</h3>
          <div className="text-sm text-gray-700 space-y-1">
            <p>Event: {title || '—'}</p>
            <p>Location: {location || '—'}</p>
            <p>Timezone: {timezone}</p>
            <p>Days: {previewDates.length || '—'}</p>
            <p>Slots per day: {selectedSlots.size || '—'}</p>
            <p>Total sessions: {previewDates.length * selectedSlots.size || '—'}</p>
            <p>Max attendees: {previewDates.length * selectedSlots.size * 3 || '—'}</p>
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
