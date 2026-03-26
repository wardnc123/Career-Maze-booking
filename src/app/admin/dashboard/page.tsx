'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, Booking } from '@/models/types';

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

const ALL_DATES = generateDates();

type CapacityFilter = 'all' | 'green' | 'yellow' | 'red';

interface Stats {
  totalBookings: number;
  fullSessions: number;
  emptySessions: number;
  waitlistCount: number;
}

// Re-exported from shared utility for use in this component
import { getIndicatorColor } from '@/lib/dashboardColor';

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(ALL_DATES[0]);
  const [capacityFilter, setCapacityFilter] = useState<CapacityFilter>('all');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Booking[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const getToken = useCallback((): string | null => {
    return localStorage.getItem('adminToken');
  }, []);

  // Auth check + initial data fetch
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/admin/login');
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        const [sessionsRes, statsRes] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/admin/stats', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (statsRes.status === 401) {
          localStorage.removeItem('adminToken');
          router.push('/admin/login');
          return;
        }

        if (!sessionsRes.ok) throw new Error('Failed to load sessions');
        if (!statsRes.ok) throw new Error('Failed to load stats');

        const [sessionsData, statsData] = await Promise.all([
          sessionsRes.json(),
          statsRes.json(),
        ]);

        if (!cancelled) {
          setSessions(sessionsData);
          setStats(statsData);
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
  }, [getToken, router]);

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('session:updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === data.sessionId
              ? { ...s, bookingCount: data.bookingCount, slotStatus: data.slotStatus }
              : s
          )
        );
        // Re-fetch stats on session update
        const token = getToken();
        if (token) {
          fetch('/api/admin/stats', {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => { if (data) setStats(data); })
            .catch(() => {});
        }
      } catch { /* ignore parse errors */ }
    });

    eventSource.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => eventSource.close();
  }, [getToken]);

  // Search handler
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const token = getToken();
    if (!token) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.push('/admin/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch { /* ignore */ } finally {
      setSearching(false);
    }
  }, [searchQuery, getToken, router]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    const token = getToken();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('adminToken');
    router.push('/admin/login');
  }, [getToken, router]);

  // Export handler
  const handleExport = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push('/admin/login');
      return;
    }

    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/admin/export?date=${encodeURIComponent(selectedDate)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.push('/admin/login');
        return;
      }

      if (!res.ok) {
        throw new Error('Export failed. Please try again.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bookings-export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [getToken, router, selectedDate]);

  // Filter sessions for selected date + capacity
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => s.sessionDate === selectedDate)
      .filter((s) => {
        if (capacityFilter === 'all') return true;
        if (capacityFilter === 'green') return s.bookingCount <= 1;
        if (capacityFilter === 'yellow') return s.bookingCount === 2;
        if (capacityFilter === 'red') return s.bookingCount === 3;
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions, selectedDate, capacityFilter]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Loading dashboard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600 text-lg">Error: {error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Career Maze · August 3–22, 2026 · All times in Europe/London
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </header>

        {/* Stats Panel */}
        {stats && <StatsPanel stats={stats} />}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Search by name, email, or PF…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search bookings"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
            {searchResults !== null && (
              <button
                onClick={() => { setSearchResults(null); setSearchQuery(''); }}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {searchResults !== null && (
            <SearchResultsPanel results={searchResults} sessions={sessions} />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
            <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <select
              id="date-filter"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_DATES.map((d) => (
                <option key={d} value={d}>{formatDateLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="capacity-filter" className="block text-sm font-medium text-gray-700 mb-1">Capacity Status</label>
            <select
              id="capacity-filter"
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value as CapacityFilter)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="green">Green (0–1 bookings)</option>
              <option value="yellow">Yellow (2 bookings)</option>
              <option value="red">Red (3 bookings)</option>
            </select>
          </div>
          <div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              aria-label="Export bookings as CSV"
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Export Error */}
        {exportError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {exportError}
          </div>
        )}

        {/* Color Legend */}
        <div className="flex flex-wrap gap-4 mb-4" role="list" aria-label="Color indicator legend">
          <div className="flex items-center gap-1.5 text-sm" role="listitem">
            <span className="inline-block w-3 h-3 rounded-full bg-green-400" aria-hidden="true" />
            <span className="text-gray-700">Green (0–1 bookings)</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm" role="listitem">
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" aria-hidden="true" />
            <span className="text-gray-700">Yellow (2 bookings)</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm" role="listitem">
            <span className="inline-block w-3 h-3 rounded-full bg-red-400" aria-hidden="true" />
            <span className="text-gray-700">Red (3 bookings)</span>
          </div>
        </div>

        {/* Session Grid */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Sessions — {formatDateLabel(selectedDate)}
          </h2>
          {filteredSessions.length === 0 ? (
            <p className="text-gray-500 text-sm">No sessions match the current filters.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-2 sm:gap-3">
              {filteredSessions.map((session) => {
                const londonTime = utcToLondon(session.startTime);
                const indicator = getIndicatorColor(session.bookingCount);
                return (
                  <div
                    key={session.id}
                    className={`rounded-lg border p-3 text-center ${indicator.bg}`}
                    aria-label={`${londonTime} — ${indicator.label} (${session.bookingCount}/3 booked)`}
                  >
                    <div className={`text-sm sm:text-base font-semibold ${indicator.text}`}>
                      {londonTime}
                    </div>
                    <div className={`text-xs mt-0.5 ${indicator.text} opacity-75`}>
                      {session.bookingCount}/3
                    </div>
                    <div className={`text-xs mt-0.5 ${indicator.text}`}>
                      {indicator.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatsPanel({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Total Bookings', value: stats.totalBookings, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'Full Sessions', value: stats.fullSessions, color: 'text-red-700 bg-red-50 border-red-200' },
    { label: 'Empty Sessions', value: stats.emptySessions, color: 'text-green-700 bg-green-50 border-green-200' },
    { label: 'Waitlist Count', value: stats.waitlistCount, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map((item) => (
        <div key={item.label} className={`rounded-lg border p-4 ${item.color}`}>
          <div className="text-2xl font-bold">{item.value}</div>
          <div className="text-sm mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function SearchResultsPanel({ results, sessions }: { results: Booking[]; sessions: Session[] }) {
  if (results.length === 0) {
    return <p className="mt-3 text-sm text-gray-500">No results found.</p>;
  }

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-gray-700">Name</th>
            <th className="text-left px-3 py-2 font-medium text-gray-700">Email</th>
            <th className="text-left px-3 py-2 font-medium text-gray-700">PF</th>
            <th className="text-left px-3 py-2 font-medium text-gray-700">Session</th>
            <th className="text-left px-3 py-2 font-medium text-gray-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((b) => {
            const session = sessionMap.get(b.sessionId);
            const sessionLabel = session
              ? `${formatDateLabel(session.sessionDate)} ${utcToLondon(session.startTime)}`
              : b.sessionId;
            return (
              <tr key={b.id} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 text-gray-900">{b.name}</td>
                <td className="px-3 py-2 text-gray-600">{b.email}</td>
                <td className="px-3 py-2 text-gray-600">{b.pf}</td>
                <td className="px-3 py-2 text-gray-600">{sessionLabel}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    b.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {b.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
