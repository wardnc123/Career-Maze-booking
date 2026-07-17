'use client';

import { useEffect, useState, useMemo, use } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import type { CareerMazeEvent, Program } from '@/models/types';
import leadershipData from '@/data/leadershipData.json';
import ukEmployees from '@/data/ukEmployees.json';
import euEmployees from '@/data/euEmployees.json';

interface AdminBooking {
  id: string; name: string; email: string; role: string; pf: string;
  status: string; referenceCode: string; promotedFromWaitlist: boolean;
  isWaitlisted: boolean;
  alias: string; vpAlias: string; level: string; tenure: string; attended: boolean;
  sessionDate: string; startTime: string;
  eventTitle: string; eventLocation: string;
}

interface LeaderDirector {
  name: string; level: string; vpAlias: string; pf: string; glTeam: string;
  l3: number; l4: number; l5: number; l6: number; l7: number; l8: number; l99: number;
  totalHC: number; expectedMM: number; expectedSignups: number;
}

interface LeaderVP {
  name: string; totalHC: number; expectedMM: number; expectedSignups: number;
  directors: LeaderDirector[];
}

interface UKEmployee {
  leader: string; leaderLevel: string; team: string; name: string;
  alias: string; level: number; title: string; manager: string;
  city: string; hireDate: string; tenure: string;
}

interface EUEmployee {
  name: string; alias: string; title: string; level: number; email: string;
  department: string; country: string; city: string; tenureDays: number;
  manager: string; director: string; vp: string; glTeam: string;
}

export default function InsightsPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [events, setEvents] = useState<CareerMazeEvent[]>([]);
  const [allBookings, setAllBookings] = useState<AdminBooking[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(['L3', 'L4', 'L5', 'L6', 'L7', 'L8']));
  const [selectedTenures, setSelectedTenures] = useState<Set<string>>(new Set(['<1 year', '1-3 years', '3-5 years', '5-7 years', '7-10 years', '10+ years']));
  const [selectedVPs, setSelectedVPs] = useState<Set<string>>(new Set());
  const [allLevelsChecked, setAllLevelsChecked] = useState(true);
  const [allTenuresChecked, setAllTenuresChecked] = useState(true);
  const [showAllVPs, setShowAllVPs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'insights' | 'leadership'>('insights');

  // Leadership tracker state
  const [tolerance, setTolerance] = useState(60);
  const [expandedVPs, setExpandedVPs] = useState<Set<number>>(new Set());
  const [ltEventFilter, setLtEventFilter] = useState<string>('all');
  const [ltMarketplaces, setLtMarketplaces] = useState<Set<string>>(new Set(['London', 'Manchester']));
  const [ltLevels, setLtLevels] = useState<Set<string>>(new Set(['3', '4', '5', '6', '7', '8']));
  const [expectedOverrides, setExpectedOverrides] = useState<Record<string, number>>({});
  const [showEditExpected, setShowEditExpected] = useState(false);

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

      // Initialize VP selection with all unique VPs
      const vpSet = new Set(programBookings.map(b => b.vpAlias || '(none)'));
      setSelectedVPs(vpSet);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [programId]);

  // Event filter helpers
  function toggleEvent(eventId: string) {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }
  function selectAllEvents() { setSelectedEventIds(new Set(events.map(e => e.id))); }
  function clearEvents() { setSelectedEventIds(new Set()); }

  // Level filter helpers
  const allLevelOptions = ['L3', 'L4', 'L5', 'L6', 'L7', 'L8'];

  function toggleLevel(level: string) {
    setSelectedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      setAllLevelsChecked(next.size === allLevelOptions.length);
      return next;
    });
  }

  function toggleAllLevels() {
    if (allLevelsChecked) {
      setSelectedLevels(new Set());
      setAllLevelsChecked(false);
    } else {
      setSelectedLevels(new Set(allLevelOptions));
      setAllLevelsChecked(true);
    }
  }

  // Tenure filter helpers
  const allTenureOptions = ['<1 year', '1-3 years', '3-5 years', '5-7 years', '7-10 years', '10+ years'];

  function toggleTenure(tenure: string) {
    setSelectedTenures(prev => {
      const next = new Set(prev);
      if (next.has(tenure)) next.delete(tenure); else next.add(tenure);
      setAllTenuresChecked(next.size === allTenureOptions.length);
      return next;
    });
  }

  function toggleAllTenures() {
    if (allTenuresChecked) {
      setSelectedTenures(new Set());
      setAllTenuresChecked(false);
    } else {
      setSelectedTenures(new Set(allTenureOptions));
      setAllTenuresChecked(true);
    }
  }

  // VP filter helpers
  const uniqueVPs = useMemo(() => {
    const vps = [...new Set(allBookings.map(b => b.vpAlias || '(none)'))];
    return vps.sort();
  }, [allBookings]);

  function toggleVP(vp: string) {
    setSelectedVPs(prev => {
      const next = new Set(prev);
      if (next.has(vp)) next.delete(vp); else next.add(vp);
      return next;
    });
  }

  function selectAllVPs() { setSelectedVPs(new Set(uniqueVPs)); }
  function clearVPs() { setSelectedVPs(new Set()); }

  // Apply all filters
  const filtered = useMemo(() => {
    return allBookings
      .filter(b => {
        if (selectedEventIds.size === 0) return true;
        return events.some(ev => selectedEventIds.has(ev.id) && ev.title === b.eventTitle);
      })
      .filter(b => {
        if (selectedLevels.size === 0) return true;
        return selectedLevels.has(b.level || '');
      })
      .filter(b => {
        if (selectedTenures.size === 0) return true;
        return selectedTenures.has(b.tenure || '');
      })
      .filter(b => {
        if (selectedVPs.size === 0) return true;
        return selectedVPs.has(b.vpAlias || '(none)');
      });
  }, [allBookings, selectedEventIds, events, selectedLevels, selectedTenures, selectedVPs]);

  // Metrics
  const metrics = useMemo(() => {
    const total = filtered.length;
    const confirmed = filtered.filter(b => b.status === 'confirmed').length;
    const attended = filtered.filter(b => b.attended && b.status === 'confirmed').length;
    const cancelled = filtered.filter(b => b.status === 'cancelled').length;
    const waitlisted = filtered.filter(b => b.isWaitlisted || b.promotedFromWaitlist).length;
    const promoted = filtered.filter(b => b.promotedFromWaitlist).length;
    const noShow = confirmed - attended;

    const attendanceRate = confirmed > 0 ? Math.round((attended / confirmed) * 100) : 0;
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const waitlistConversion = waitlisted > 0 ? Math.round((promoted / waitlisted) * 100) : 0;
    const noShowRate = confirmed > 0 ? Math.round((noShow / confirmed) * 100) : 0;

    return { total, confirmed, attendanceRate, cancellationRate, waitlistConversion, noShowRate };
  }, [filtered]);

  // Breakdown by Level
  const levelBreakdown = useMemo(() => {
    const levels = allLevelOptions;
    return levels.map(level => {
      const levelBookings = filtered.filter(b => b.level === level);
      const signups = levelBookings.length;
      const confirmed = levelBookings.filter(b => b.status === 'confirmed').length;
      const attended = levelBookings.filter(b => b.attended && b.status === 'confirmed').length;
      const cancelled = levelBookings.filter(b => b.status === 'cancelled').length;
      const attendancePct = confirmed > 0 ? Math.round((attended / confirmed) * 100) : 0;
      const cancelPct = signups > 0 ? Math.round((cancelled / signups) * 100) : 0;
      return { level, signups, confirmed, attended, attendancePct, cancelled, cancelPct };
    }).filter(row => row.signups > 0);
  }, [filtered]);

  // Breakdown by Tenure
  const tenureBreakdown = useMemo(() => {
    return allTenureOptions.map(tenure => {
      const tenureBookings = filtered.filter(b => b.tenure === tenure);
      const signups = tenureBookings.length;
      const confirmed = tenureBookings.filter(b => b.status === 'confirmed').length;
      const attended = tenureBookings.filter(b => b.attended && b.status === 'confirmed').length;
      const cancelled = tenureBookings.filter(b => b.status === 'cancelled').length;
      const attendancePct = confirmed > 0 ? Math.round((attended / confirmed) * 100) : 0;
      const cancelPct = signups > 0 ? Math.round((cancelled / signups) * 100) : 0;
      return { tenure, signups, confirmed, attended, attendancePct, cancelled, cancelPct };
    }).filter(row => row.signups > 0);
  }, [filtered]);

  // Breakdown by VP Alias
  const vpBreakdown = useMemo(() => {
    const map = new Map<string, { signups: number; confirmed: number; attended: number; cancelled: number }>();
    for (const b of filtered) {
      const vp = b.vpAlias || '(none)';
      if (!map.has(vp)) map.set(vp, { signups: 0, confirmed: 0, attended: 0, cancelled: 0 });
      const entry = map.get(vp)!;
      entry.signups++;
      if (b.status === 'confirmed') entry.confirmed++;
      if (b.attended && b.status === 'confirmed') entry.attended++;
      if (b.status === 'cancelled') entry.cancelled++;
    }
    return [...map.entries()]
      .map(([vp, data]) => ({ vp, ...data, attendancePct: data.confirmed > 0 ? Math.round((data.attended / data.confirmed) * 100) : 0 }))
      .sort((a, b) => b.signups - a.signups);
  }, [filtered]);

  // Breakdown by Event
  const eventBreakdown = useMemo(() => {
    const programEvents = events.filter(ev => selectedEventIds.size === 0 || selectedEventIds.has(ev.id));
    return programEvents.map(ev => {
      const evBookings = filtered.filter(b => b.eventTitle === ev.title);
      const signups = evBookings.length;
      const confirmed = evBookings.filter(b => b.status === 'confirmed').length;
      const attended = evBookings.filter(b => b.attended && b.status === 'confirmed').length;
      const attendancePct = confirmed > 0 ? Math.round((attended / confirmed) * 100) : 0;
      const utilisationPct = signups > 0 ? Math.round((confirmed / signups) * 100) : 0;
      return { title: ev.title, signups, confirmed, attended, attendancePct, utilisationPct };
    }).filter(row => row.signups > 0);
  }, [filtered, events, selectedEventIds]);

  // Bar chart data
  const maxLevelCount = useMemo(() => Math.max(...levelBreakdown.map(r => r.signups), 1), [levelBreakdown]);

  // Available marketplace options derived from data
  const marketplaceOptions = useMemo(() => {
    const ukCities = [...new Set((ukEmployees as UKEmployee[]).map(e => e.city))].sort();
    const euCountries = [...new Set((euEmployees as EUEmployee[]).map(e => e.country))].sort();
    return { ukCities, euCountries, all: [...ukCities, ...euCountries] };
  }, []);

  // Leadership tracker: match bookings by VP alias to the static reference data
  const leadershipTracker = useMemo(() => {
    // Build a set of known VP aliases from leadershipData
    const allKnownVPAliases = new Set<string>();
    for (const vp of leadershipData as LeaderVP[]) {
      for (const d of vp.directors) {
        allKnownVPAliases.add(d.vpAlias.toLowerCase());
      }
    }

    // Filter bookings for sign-up count: confirmed only (exclude cancelled & weekends) + event filter
    const filteredBookings = allBookings.filter(b => {
      if (b.status !== 'confirmed') return false;
      // Exclude weekend sessions
      if (b.sessionDate) {
        const day = new Date(b.sessionDate + 'T00:00:00').getDay();
        if (day === 0 || day === 6) return false;
      }
      if (ltEventFilter !== 'all') {
        if (b.eventTitle !== ltEventFilter) return false;
      }
      return true;
    });

    // Count sign-ups per VP alias
    const signupsByVPAlias = new Map<string, number>();
    let nonStoresSignups = 0;
    const nonStoresVPMap = new Map<string, number>();

    for (const b of filteredBookings) {
      const vp = (b.vpAlias || '').toLowerCase().trim();
      if (!vp) continue;
      if (allKnownVPAliases.has(vp)) {
        signupsByVPAlias.set(vp, (signupsByVPAlias.get(vp) || 0) + 1);
      } else {
        nonStoresSignups++;
        nonStoresVPMap.set(vp, (nonStoresVPMap.get(vp) || 0) + 1);
      }
    }

    // Filter UK employees by marketplace (city) and level
    const filteredUK = (ukEmployees as UKEmployee[]).filter(emp => {
      if (!ltMarketplaces.has(emp.city)) return false;
      if (!ltLevels.has(String(emp.level))) return false;
      return true;
    });

    // Filter EU employees by marketplace (country) and level
    const filteredEU = (euEmployees as EUEmployee[]).filter(emp => {
      if (!ltMarketplaces.has(emp.country)) return false;
      if (!ltLevels.has(String(emp.level))) return false;
      return true;
    });

    // Count HC per director from UK employees (leader field matches director name)
    const hcByDirector = new Map<string, number>();
    for (const emp of filteredUK) {
      const dirName = emp.leader;
      hcByDirector.set(dirName, (hcByDirector.get(dirName) || 0) + 1);
    }
    // Also count from EU employees using director field
    for (const emp of filteredEU) {
      const dirName = emp.director;
      // Map EU director alias to director name from leadershipData
      // EU data uses alias in director field, so we match by checking all directors
      hcByDirector.set(dirName, (hcByDirector.get(dirName) || 0) + 1);
    }

    // Build VP rows
    const vpRows = (leadershipData as LeaderVP[]).map(vp => {
      const vpAlias = vp.directors.length > 0 ? vp.directors[0].vpAlias.toLowerCase() : '';
      const actualSignups = signupsByVPAlias.get(vpAlias) || 0;

      const directors = vp.directors.map(d => {
        const dirHC = hcByDirector.get(d.name) || 0;
        const calcExpected = Math.round(dirHC * (tolerance / 100));
        const dirExpected = expectedOverrides[d.name] !== undefined ? expectedOverrides[d.name] : calcExpected;
        return { ...d, filteredHC: dirHC, expectedSignups: dirExpected, calcExpected };
      });

      const totalFilteredHC = directors.reduce((s, d) => s + d.filteredHC, 0);
      const calcExpected = Math.round(totalFilteredHC * (tolerance / 100));
      const vpExpected = expectedOverrides[vp.name] !== undefined ? expectedOverrides[vp.name] : calcExpected;
      const signupDelta = actualSignups - vpExpected;

      return {
        ...vp,
        vpAlias,
        actualSignups,
        totalFilteredHC,
        expectedSignups: vpExpected,
        calcExpected,
        signupDelta,
        directors,
      };
    });

    // Sort by actual sign-ups descending
    vpRows.sort((a, b) => b.actualSignups - a.actualSignups);

    // Non-stores breakdown
    const nonStoresDirectors = [...nonStoresVPMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([alias, count]) => ({ alias, count }));

    return { vpRows, nonStoresSignups, nonStoresDirectors };
  }, [allBookings, tolerance, ltEventFilter, ltMarketplaces, ltLevels, expectedOverrides]);

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
  const visibleVPs = showAllVPs ? uniqueVPs : uniqueVPs.slice(0, 10);

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
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
            <h1 className="text-2xl sm:text-3xl font-bold">{program.name} — Insights</h1>
            <p className="mt-1 text-sm opacity-75">{filtered.length} bookings matching filters</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 sm:px-6 lg:px-8 flex gap-3 flex-wrap">
          <button onClick={() => router.push(`/admin/programs/${programId}`)} className="text-sm opacity-75 hover:opacity-100 transition-opacity">← Back to Program</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Tab toggle */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'insights' ? 'bg-white border border-b-white border-gray-200 -mb-px text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Insights
          </button>
          <button
            onClick={() => setActiveTab('leadership')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'leadership' ? 'bg-white border border-b-white border-gray-200 -mb-px text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Leadership Tracker
          </button>
        </div>

        {activeTab === 'leadership' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Summary by Leader</h2>
            <p className="text-sm text-gray-500 mb-4">Live sign-up numbers compared against headcount targets. Click a VP row to expand their org. Sign-ups matched by VP alias from bookings.</p>

            {/* Filters */}
            <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-4">
              {/* Event filter */}
              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Event:</label>
                <select
                  value={ltEventFilter}
                  onChange={(e) => setLtEventFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
                >
                  <option value="all">All Events</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.title}>{ev.title}</option>
                  ))}
                </select>
              </div>

              {/* Marketplace filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Marketplace:</label>
                <div className="flex flex-wrap gap-3 items-center">
                  {marketplaceOptions.all.map(mp => (
                    <label key={mp} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ltMarketplaces.has(mp)}
                        onChange={() => {
                          setLtMarketplaces(prev => {
                            const next = new Set(prev);
                            if (next.has(mp)) next.delete(mp); else next.add(mp);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {mp}
                    </label>
                  ))}
                </div>
              </div>

              {/* Level filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Level:</label>
                <div className="flex flex-wrap gap-3 items-center">
                  {['3', '4', '5', '6', '7', '8'].map(lvl => (
                    <label key={lvl} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ltLevels.has(lvl)}
                        onChange={() => {
                          setLtLevels(prev => {
                            const next = new Set(prev);
                            if (next.has(lvl)) next.delete(lvl); else next.add(lvl);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      L{lvl}
                    </label>
                  ))}
                </div>
              </div>

              {/* Tolerance slider */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Expected sign-up tolerance:</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-bold text-gray-900 w-12 text-right">{tolerance}%</span>
              </div>
              <p className="text-xs text-gray-500">Expected # of sign-ups = Filtered HC × {tolerance}%</p>
              {/* Edit expected toggle */}
              <div className="flex items-center gap-2 mt-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEditExpected}
                    onChange={(e) => setShowEditExpected(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Edit expected sign-ups manually
                </label>
              </div>
            </div>

            {/* Grand total */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="rounded-lg border p-4 bg-blue-50 text-blue-800 border-blue-200">
                <div className="text-2xl font-bold">{leadershipTracker.vpRows.reduce((s, v) => s + v.totalFilteredHC, 0)}</div>
                <div className="text-sm font-medium mt-1">Total HC (filtered)</div>
              </div>
              <div className="rounded-lg border p-4 bg-emerald-50 text-emerald-800 border-emerald-200">
                <div className="text-2xl font-bold">{leadershipTracker.vpRows.reduce((s, v) => s + v.actualSignups, 0) + leadershipTracker.nonStoresSignups}</div>
                <div className="text-sm font-medium mt-1">Total Sign-ups</div>
              </div>
              <div className="rounded-lg border p-4 bg-violet-50 text-violet-800 border-violet-200">
                <div className="text-2xl font-bold">{leadershipTracker.vpRows.reduce((s, v) => s + v.expectedSignups, 0)}</div>
                <div className="text-sm font-medium mt-1">Expected Sign-ups ({tolerance}%)</div>
              </div>
              <div className="rounded-lg border p-4 bg-amber-50 text-amber-800 border-amber-200">
                <div className="text-2xl font-bold">{leadershipTracker.nonStoresSignups}</div>
                <div className="text-sm font-medium mt-1">Non-Stores Sign-ups</div>
              </div>
            </div>

            {/* VP-level table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Leader Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Leader Level</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">PF</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">GL/Team</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Total HC</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Expected Sign-ups</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Number of Sign-ups</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadershipTracker.vpRows.map((vp, vpIdx) => (
                      <React.Fragment key={`vp-${vpIdx}`}>
                        {/* VP summary row - clickable */}
                        <tr
                          className="bg-gray-100 border-b border-gray-200 font-semibold cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={() => setExpandedVPs(prev => {
                            const next = new Set(prev);
                            if (next.has(vpIdx)) next.delete(vpIdx); else next.add(vpIdx);
                            return next;
                          })}
                        >
                          <td className="px-3 py-2">
                            <span className="mr-2">{expandedVPs.has(vpIdx) ? '▼' : '▶'}</span>
                            {vp.name}
                          </td>
                          <td className="px-3 py-2 text-gray-600">VP</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          <td className="text-center px-3 py-2">{vp.totalFilteredHC}</td>
                          <td className="text-center px-3 py-2">
                            {showEditExpected ? (
                              <input
                                type="number"
                                className="w-16 text-center border border-gray-300 rounded px-1 py-0.5 text-sm bg-white"
                                placeholder={String(vp.calcExpected)}
                                value={expectedOverrides[vp.name] !== undefined ? expectedOverrides[vp.name] : ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExpectedOverrides(prev => {
                                    const next = { ...prev };
                                    if (val === '') { delete next[vp.name]; } else { next[vp.name] = Number(val); }
                                    return next;
                                  });
                                }}
                              />
                            ) : (
                              <span>{vp.expectedSignups}</span>
                            )}
                          </td>
                          <td className="text-center px-3 py-2 font-bold">{vp.actualSignups}</td>
                          <td className={`text-center px-3 py-2 font-bold ${vp.signupDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{vp.signupDelta >= 0 ? '+' : ''}{vp.signupDelta}</td>
                        </tr>

                        {/* Director rows - shown when expanded */}
                        {expandedVPs.has(vpIdx) && vp.directors.map((d, dIdx) => (
                          <tr key={`d-${vpIdx}-${dIdx}`} className="border-b border-gray-100 last:border-0 bg-white">
                            <td className="px-3 py-2 pl-8">{d.name}</td>
                            <td className="px-3 py-2 text-gray-600">{d.level}</td>
                            <td className="px-3 py-2 text-gray-600">{d.pf}</td>
                            <td className="px-3 py-2 text-gray-600">{d.glTeam}</td>
                            <td className="text-center px-3 py-2">{d.filteredHC}</td>
                            <td className="text-center px-3 py-2">{d.expectedSignups}</td>
                            <td className="text-center px-3 py-2">—</td>
                            <td className="text-center px-3 py-2">—</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Non-Stores row */}
                    {leadershipTracker.nonStoresSignups > 0 && (
                      <React.Fragment>
                        <tr
                          className="bg-orange-50 border-b border-gray-200 font-semibold cursor-pointer hover:bg-orange-100 transition-colors"
                          onClick={() => setExpandedVPs(prev => {
                            const next = new Set(prev);
                            const nsIdx = 999;
                            if (next.has(nsIdx)) next.delete(nsIdx); else next.add(nsIdx);
                            return next;
                          })}
                        >
                          <td className="px-3 py-2">
                            <span className="mr-2">{expandedVPs.has(999) ? '▼' : '▶'}</span>
                            Non-Stores
                          </td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          <td className="text-center px-3 py-2">—</td>
                          <td className="text-center px-3 py-2">—</td>
                          <td className="text-center px-3 py-2 font-bold">{leadershipTracker.nonStoresSignups}</td>
                          <td className="text-center px-3 py-2">—</td>
                        </tr>
                        {expandedVPs.has(999) && leadershipTracker.nonStoresDirectors.map((d, dIdx) => (
                          <tr key={`ns-${dIdx}`} className="border-b border-gray-100 last:border-0 bg-white">
                            <td className="px-3 py-2 pl-8">{d.alias}</td>
                            <td className="px-3 py-2 text-gray-500 italic">Unrecognized VP alias</td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2"></td>
                            <td className="text-center px-3 py-2">—</td>
                            <td className="text-center px-3 py-2">—</td>
                            <td className="text-center px-3 py-2">{d.count}</td>
                            <td className="text-center px-3 py-2">—</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (<>
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

        {/* Level filter */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Filter by Level</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allLevelsChecked}
                onChange={toggleAllLevels}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              All
            </label>
            {allLevelOptions.map(level => (
              <label key={level} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLevels.has(level)}
                  onChange={() => toggleLevel(level)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {level}
              </label>
            ))}
          </div>
        </section>

        {/* Tenure filter */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Filter by Tenure</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allTenuresChecked}
                onChange={toggleAllTenures}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              All
            </label>
            {allTenureOptions.map(tenure => (
              <label key={tenure} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTenures.has(tenure)}
                  onChange={() => toggleTenure(tenure)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {tenure}
              </label>
            ))}
          </div>
        </section>

        {/* VP Alias filter */}
        {uniqueVPs.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Filter by VP Alias</h2>
              <div className="flex gap-2">
                <button onClick={selectAllVPs} className="text-xs text-blue-600 hover:underline">Select All</button>
                <button onClick={clearVPs} className="text-xs text-blue-600 hover:underline">Clear</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {visibleVPs.map(vp => (
                <label key={vp} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedVPs.has(vp)}
                    onChange={() => toggleVP(vp)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {vp}
                </label>
              ))}
            </div>
            {uniqueVPs.length > 10 && (
              <button onClick={() => setShowAllVPs(!showAllVPs)} className="mt-2 text-xs text-blue-600 hover:underline">
                {showAllVPs ? 'Show less' : `Show all (${uniqueVPs.length})`}
              </button>
            )}
          </section>
        )}

        {/* Metrics cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <div className="rounded-lg border p-4 bg-blue-50 text-blue-800 border-blue-200">
            <div className="text-2xl font-bold">{metrics.total}</div>
            <div className="text-sm font-medium mt-1">Total Sign-ups</div>
          </div>
          <div className="rounded-lg border p-4 bg-emerald-50 text-emerald-800 border-emerald-200">
            <div className="text-2xl font-bold">{metrics.confirmed}</div>
            <div className="text-sm font-medium mt-1">Confirmed</div>
          </div>
          <div className="rounded-lg border p-4 bg-violet-50 text-violet-800 border-violet-200">
            <div className="text-2xl font-bold">{metrics.attendanceRate}%</div>
            <div className="text-sm font-medium mt-1">Attendance Rate</div>
          </div>
          <div className="rounded-lg border p-4 bg-red-50 text-red-800 border-red-200">
            <div className="text-2xl font-bold">{metrics.cancellationRate}%</div>
            <div className="text-sm font-medium mt-1">Cancellation Rate</div>
          </div>
          <div className="rounded-lg border p-4 bg-purple-50 text-purple-800 border-purple-200">
            <div className="text-2xl font-bold">{metrics.waitlistConversion}%</div>
            <div className="text-sm font-medium mt-1">Waitlist → Confirmed</div>
          </div>
          <div className="rounded-lg border p-4 bg-amber-50 text-amber-800 border-amber-200">
            <div className="text-2xl font-bold">{metrics.noShowRate}%</div>
            <div className="text-sm font-medium mt-1">No-show Rate</div>
          </div>
        </div>

        {/* Breakdown by Level */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Level</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Level</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Sign-ups</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Confirmed</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attended</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attendance %</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cancelled</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cancel %</th>
              </tr>
            </thead>
            <tbody>
              {levelBreakdown.map(row => (
                <tr key={row.level} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{row.level}</td>
                  <td className="px-3 py-2">{row.signups}</td>
                  <td className="px-3 py-2">{row.confirmed}</td>
                  <td className="px-3 py-2">{row.attended}</td>
                  <td className="px-3 py-2">{row.attendancePct}%</td>
                  <td className="px-3 py-2">{row.cancelled}</td>
                  <td className="px-3 py-2">{row.cancelPct}%</td>
                </tr>
              ))}
              {levelBreakdown.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">No data for selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Level distribution bar chart */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Level Distribution</h2>
        <div className="rounded-lg border border-gray-200 p-4 mb-8">
          {levelBreakdown.map(row => (
            <div key={row.level} className="flex items-center gap-3 mb-2 last:mb-0">
              <span className="w-8 text-sm font-medium text-gray-700">{row.level}</span>
              <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${Math.round((row.signups / maxLevelCount) * 100)}%`,
                    backgroundColor: brandColor,
                  }}
                />
              </div>
              <span className="text-sm text-gray-600 w-8 text-right">{row.signups}</span>
            </div>
          ))}
          {levelBreakdown.length === 0 && (
            <p className="text-sm text-gray-500 text-center">No data for selected filters</p>
          )}
        </div>

        {/* Breakdown by VP Alias */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Tenure</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Tenure</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Sign-ups</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Confirmed</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attended</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attendance %</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cancelled</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cancel %</th>
              </tr>
            </thead>
            <tbody>
              {tenureBreakdown.map(row => (
                <tr key={row.tenure} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{row.tenure}</td>
                  <td className="px-3 py-2">{row.signups}</td>
                  <td className="px-3 py-2">{row.confirmed}</td>
                  <td className="px-3 py-2">{row.attended}</td>
                  <td className="px-3 py-2">{row.attendancePct}%</td>
                  <td className="px-3 py-2">{row.cancelled}</td>
                  <td className="px-3 py-2">{row.cancelPct}%</td>
                </tr>
              ))}
              {tenureBreakdown.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">No data for selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Breakdown by VP Alias */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by VP Alias</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">VP Alias</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Sign-ups</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Confirmed</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attended</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attendance %</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {vpBreakdown.map(row => (
                <tr key={row.vp} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{row.vp}</td>
                  <td className="px-3 py-2">{row.signups}</td>
                  <td className="px-3 py-2">{row.confirmed}</td>
                  <td className="px-3 py-2">{row.attended}</td>
                  <td className="px-3 py-2">{row.attendancePct}%</td>
                  <td className="px-3 py-2">{row.cancelled}</td>
                </tr>
              ))}
              {vpBreakdown.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">No data for selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Breakdown by Event */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Event</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Event</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Sign-ups</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Confirmed</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attended</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Attendance %</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Utilisation %</th>
              </tr>
            </thead>
            <tbody>
              {eventBreakdown.map(row => (
                <tr key={row.title} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{row.title}</td>
                  <td className="px-3 py-2">{row.signups}</td>
                  <td className="px-3 py-2">{row.confirmed}</td>
                  <td className="px-3 py-2">{row.attended}</td>
                  <td className="px-3 py-2">{row.attendancePct}%</td>
                  <td className="px-3 py-2">{row.utilisationPct}%</td>
                </tr>
              ))}
              {eventBreakdown.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">No data for selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>)}
      </div>
    </main>
  );
}
