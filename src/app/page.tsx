'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Program } from '@/models/types';

export default function HomePage() {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrograms() {
      try {
        const res = await fetch('/api/programs', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load programs');
        const data: Program[] = await res.json();
        if (cancelled) return;
        const active = data.filter((p) => p.active);
        if (active.length === 1) {
          window.location.href = `/programs/${active[0].id}`;
          return;
        }
        setPrograms(active);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }
    fetchPrograms();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600 text-lg">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-600 text-lg">Error: {error}</p>
      </main>
    );
  }

  if (!programs || programs.length === 0) {
    return (
      <main className="min-h-screen bg-white">
        <div className="bg-[#1a1a2e] text-white">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl sm:text-3xl font-bold">Booking Platform</h1>
            <p className="mt-1 text-sm text-gray-300">Browse programs and book sessions</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-600 text-lg mb-4">No programs are currently available.</p>
          <p className="text-gray-500 text-sm">Check back soon, or contact the organiser for details.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Booking Platform</h1>
          <p className="mt-1 text-sm text-gray-300">Choose a program to book a session</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program) => (
            <a
              key={program.id}
              href={`/programs/${program.id}`}
              className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              style={{ borderColor: program.brandColor }}
            >
              <div className="h-2" style={{ backgroundColor: program.brandColor }} />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  {program.logoUrl ? (
                    <Image
                      src={program.logoUrl}
                      alt={`${program.name} logo`}
                      width={64}
                      height={64}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-xl font-bold"
                      style={{ backgroundColor: program.brandColor }}
                    >
                      {program.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h2 className="text-lg font-semibold text-gray-900">{program.name}</h2>
                </div>
                <p className="text-sm text-gray-500">
                  {program.sessionDurationMinutes >= 60
                    ? `${program.sessionDurationMinutes / 60}h sessions`
                    : `${program.sessionDurationMinutes}min sessions`}
                  {' · '}Up to {program.maxAttendees} attendee{program.maxAttendees !== 1 ? 's' : ''} per slot
                </p>
                <div className="mt-4">
                  <span
                    className="inline-block px-3 py-1 text-sm font-medium text-white rounded"
                    style={{ backgroundColor: program.brandColor }}
                  >
                    Book Now →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-2">Need to manage your bookings?</p>
          <div className="flex gap-4 justify-center">
            <a href="/my-bookings" className="text-sm text-blue-600 hover:underline font-medium">My Bookings</a>
            <a href="/cancel" className="text-sm text-red-600 hover:underline font-medium">Cancel a Booking</a>
          </div>
        </div>
      </div>
    </main>
  );
}
