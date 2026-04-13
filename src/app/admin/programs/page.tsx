'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Program } from '@/models/types';

interface ProgramCardData extends Program {
  eventCount: number;
  bookingCount: number;
}

export default function AdminProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [programsRes, eventsRes, bookingsRes] = await Promise.all([
          fetch('/api/programs', { cache: 'no-store' }),
          fetch('/api/admin/setup', { cache: 'no-store' }),
          fetch('/api/admin/bookings', { cache: 'no-store' }),
        ]);

        if (!programsRes.ok) throw new Error('Failed to load programs');

        const programsData: Program[] = await programsRes.json();
        const eventsData: { id: string; programId: string }[] = eventsRes.ok ? await eventsRes.json() : [];
        const bookingsData: { id: string; status: string; eventTitle: string }[] = bookingsRes.ok ? await bookingsRes.json() : [];

        // Count events per program
        const eventCountByProgram = new Map<string, number>();
        for (const event of eventsData) {
          const pid = event.programId || 'default-career-maze';
          eventCountByProgram.set(pid, (eventCountByProgram.get(pid) || 0) + 1);
        }

        // Count confirmed bookings per program (via event title mapping)
        // We need to map events to programs, then bookings to events
        const eventTitleToProgram = new Map<string, string>();
        for (const event of eventsData) {
          eventTitleToProgram.set(event.id, event.programId || 'default-career-maze');
        }

        // Since bookings API returns eventTitle, we need a different approach
        // Count all confirmed bookings per program using sessions API
        const sessionsRes = await fetch('/api/sessions', { cache: 'no-store' });
        const sessionsData: { id: string; eventId: string }[] = sessionsRes.ok ? await sessionsRes.json() : [];

        const sessionToProgram = new Map<string, string>();
        const eventIdToProgram = new Map<string, string>();
        for (const event of eventsData) {
          eventIdToProgram.set(event.id, event.programId || 'default-career-maze');
        }
        for (const session of sessionsData) {
          const pid = eventIdToProgram.get(session.eventId) || 'default-career-maze';
          sessionToProgram.set(session.id, pid);
        }

        // bookingsData has sessionDate/startTime but not sessionId directly
        // Use the enriched bookings which have eventTitle
        // Instead, count bookings by matching event titles to programs
        const bookingCountByProgram = new Map<string, number>();
        for (const booking of bookingsData) {
          if (booking.status === 'confirmed') {
            // Find the event by title to get programId
            const matchingEvent = eventsData.find(e => (e as Record<string, unknown>).title === booking.eventTitle);
            const pid = matchingEvent ? (matchingEvent.programId || 'default-career-maze') : 'default-career-maze';
            bookingCountByProgram.set(pid, (bookingCountByProgram.get(pid) || 0) + 1);
          }
        }

        const enriched: ProgramCardData[] = programsData.map(p => ({
          ...p,
          eventCount: eventCountByProgram.get(p.id) || 0,
          bookingCount: bookingCountByProgram.get(p.id) || 0,
        }));

        setPrograms(enriched);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Loading programs…</p>
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
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Programs</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your booking programs
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/programs/new')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Create Program
          </button>
        </header>

        {programs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No programs yet.</p>
            <button
              onClick={() => router.push('/admin/programs/new')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Create Your First Program
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onClick={() => router.push(`/admin/programs/${program.id}`)}
                onSettings={() => router.push(`/admin/programs/${program.id}/settings`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ProgramCard({
  program,
  onClick,
  onSettings,
}: {
  program: ProgramCardData;
  onClick: () => void;
  onSettings: () => void;
}) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-label={`${program.name} program`}
    >
      <div
        className="h-2"
        style={{ backgroundColor: program.brandColor || '#1a1a2e' }}
      />
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {program.logoUrl ? (
            <img
              src={program.logoUrl}
              alt={`${program.name} logo`}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: program.brandColor || '#1a1a2e' }}
            >
              {program.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{program.name}</h3>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                program.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {program.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 rounded p-2 text-center">
            <div className="text-lg font-bold text-gray-900">{program.eventCount}</div>
            <div className="text-xs text-gray-500">Events</div>
          </div>
          <div className="bg-gray-50 rounded p-2 text-center">
            <div className="text-lg font-bold text-gray-900">{program.bookingCount}</div>
            <div className="text-xs text-gray-500">Bookings</div>
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onSettings(); }}
          className="w-full px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          Settings
        </button>
      </div>
    </div>
  );
}
