import { NextResponse } from 'next/server';
import { ensureLoaded, persistBooking, getBookingsStore } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

const PARTICIPANTS = [
  { name: 'Anita Kirov', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Anne Gaschemann', level: 'L7', vpAlias: 'Naggar,David', org: 'Stores Intl. & Kindle' },
  { name: 'Anne-Marie Keglmaier', level: 'L6', vpAlias: 'Heaton-Armstrong,Piers', org: 'Ads incl. non-cash' },
  { name: 'Bernhard Rubenbauer', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Carmen Roman', level: 'L7', vpAlias: 'Whyte-Southcombe,Kathryn', org: 'PXT - Corporate' },
  { name: 'Caroline Amis', level: 'L5', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Christina Blecke', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Chad Hummel', level: 'L6', vpAlias: 'Oommen,Rohan', org: 'WW Selling Partner Services' },
  { name: 'Coralie Heinemann', level: 'L6', vpAlias: 'Tagawa,John', org: 'WW Ops, FBA, XCM, & WW Grocery Stores' },
  { name: 'Daniel Dreyer', level: 'L7', vpAlias: 'Williams,David', org: 'Stores Intl. & Kindle' },
  { name: 'Deni Todorov', level: 'L6', vpAlias: 'Fife (HR),Amanda', org: 'PXT - Corporate' },
  { name: 'Durmus Cetin Akman', level: 'L7', vpAlias: 'Chen,Julia', org: 'Total AWS' },
  { name: 'Ellen Brunnhuber', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Francesca Marocco', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Franziska Fink', level: 'L5', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Friederike Leicht', level: 'L7', vpAlias: 'Hurwitz,Tami C.', org: 'Amazon Music & ATG Leadership' },
  { name: 'Gerrit Roth', level: 'L7', vpAlias: 'Beale,Brad', org: 'Total Prime Video' },
  { name: 'Guido Barbieri', level: 'L7', vpAlias: 'Tagawa,John', org: 'WW Ops, FBA, XCM, & WW Grocery Stores' },
  { name: 'Ipsita Sanghvi', level: 'L6', vpAlias: 'Agboka Jr,J. Ofori Ofori', org: 'PXT - Ops' },
  { name: 'Isabel Hartung', level: 'L7', vpAlias: 'Stewart,Geoffrey Maxwell', org: 'North America Stores' },
  { name: 'Isabel Klein', level: 'L7', vpAlias: 'Broussard,Eric L.', org: 'Stores Intl. & Kindle' },
  { name: 'Janike Deguidi', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Jasmin Kossmann', level: 'L7', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Juliana Haidn', level: 'L5', vpAlias: 'Fife (HR),Amanda', org: 'PXT - Corporate' },
  { name: 'Juliana Ringold', level: 'L6', vpAlias: 'Kyriacou,Pete', org: 'Devices and Services' },
  { name: 'Katarina Prce', level: 'L6', vpAlias: 'Perego,Stefano', org: 'WW Ops, FBA, XCM, & WW Grocery Stores' },
  { name: 'Lars Schmitz', level: 'L7', vpAlias: 'Levy,Dave', org: 'Total AWS' },
  { name: 'Manuel Fischer', level: 'L7', vpAlias: 'Perego,Stefano', org: 'WW Ops, FBA, XCM, & WW Grocery Stores' },
  { name: 'Mariella Garcia Senceb', level: 'L7', vpAlias: 'French,Eric', org: 'Finance - Core' },
  { name: 'Marlene Schöllhuber', level: 'L7', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Max Pawlak', level: 'L7', vpAlias: 'Bennett,Andrew', org: 'Total Prime Video' },
  { name: 'Michael Huber', level: 'L7', vpAlias: 'Heaton-Armstrong,Piers', org: 'Ads incl. non-cash' },
  { name: 'Michael Elbert', level: 'L7', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Michael Kech', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Nathalie Steinmaurer', level: 'L7', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Nicky Legh', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Peggy Lawson', level: 'L6', vpAlias: 'Fife (HR),Amanda', org: 'PXT - Corporate' },
  { name: 'Philipp Bode', level: 'L7', vpAlias: 'Bennett,Andrew', org: 'Total Prime Video' },
  { name: 'Rachel McKenzie', level: 'L6', vpAlias: 'Williams,David', org: 'Stores Intl. & Kindle' },
  { name: 'Raghav Sharma', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Regina Adler', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Sandra Wiesenberger', level: 'L7', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Sven Breitwieser', level: 'L7', vpAlias: 'Heaton-Armstrong,Piers', org: 'Ads incl. non-cash' },
  { name: 'Tabea Hill', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Thorsten Treusch', level: 'L6', vpAlias: 'Stewart,Geoffrey Maxwell', org: 'North America Stores' },
  { name: 'Tim Kußmaul', level: 'L6', vpAlias: 'Marseglia,Mariangela', org: 'Stores Intl. & Kindle' },
  { name: 'Volker Neuenhoff', level: 'L7', vpAlias: 'Clemens,Nicole', org: 'Total Prime Video' },
  { name: 'Wolfgang Kirschner', level: 'L7', vpAlias: 'Heaton-Armstrong,Piers', org: 'Ads incl. non-cash' },
];

function fuzzyMatch(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Check first name + last name match
  const aParts = na.split(' ');
  const bParts = nb.split(' ');
  const firstMatch = aParts[0] === bParts[0];
  const lastMatch = aParts[aParts.length - 1] === bParts[bParts.length - 1];
  if (firstMatch && lastMatch) return 0.95;
  if (lastMatch) return 0.7;
  if (firstMatch) return 0.5;
  return 0;
}

export async function POST() {
  try {
    await ensureLoaded();
    const bookings = getBookingsStore();

    const matched: { participant: string; bookingName: string; confidence: number; updated: boolean }[] = [];
    const lowConfidence: { participant: string; bestMatch: string; confidence: number }[] = [];
    const unmatched: string[] = [];

    for (const participant of PARTICIPANTS) {
      let bestScore = 0;
      let bestBooking: (typeof bookings)[number] | null = null;

      for (const booking of bookings) {
        const score = fuzzyMatch(participant.name, booking.name);
        if (score > bestScore) {
          bestScore = score;
          bestBooking = booking;
        }
      }

      if (bestScore >= 0.7 && bestBooking) {
        bestBooking.level = participant.level;
        bestBooking.vpAlias = participant.vpAlias;
        await persistBooking(bestBooking);
        matched.push({
          participant: participant.name,
          bookingName: bestBooking.name,
          confidence: bestScore,
          updated: true,
        });
      } else if (bestScore > 0 && bestBooking) {
        lowConfidence.push({
          participant: participant.name,
          bestMatch: bestBooking.name,
          confidence: bestScore,
        });
      } else {
        unmatched.push(participant.name);
      }
    }

    return NextResponse.json({ matched, lowConfidence, unmatched }, { headers: noCacheHeaders });
  } catch (error) {
    console.error('[enrich] Error:', error);
    return NextResponse.json(
      { error: 'Enrichment failed', details: String(error) },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
