// Career Maze Session Booking & Tracking System — BookingService
// Core business logic for creating, cancelling, and querying bookings.

import { v4 as uuidv4 } from 'uuid';
import type { Booking, BookingRequest, BookingResult, WaitlistEntry } from '@/models/types';
import { hasOverlap } from '@/lib/overlap';
import { deriveSlotStatus } from '@/lib/slotStatus';
import { getSession, getSessions } from '@/services/sessionService';
import type { INotificationService } from '@/services/notificationService';
import type { IAuditLogService } from '@/services/auditLogService';
import { emit } from '@/lib/eventEmitter';
import {
  getBookingsStore, getWaitlistStore,
  addBooking as dmAddBooking, addWaitlistEntry as dmAddWaitlistEntry,
  removeWaitlistEntry as dmRemoveWaitlistEntry,
  setBookingsStore, setWaitlistStore,
  getEventsStore, getProgramsStore,
} from '@/lib/dataManager';

const sessionLocks = new Set<string>();
let notificationService: INotificationService | null = null;
let auditLogService: IAuditLogService | null = null;
let referenceCounter = 0;

export function setNotificationService(s: INotificationService | null) { notificationService = s; }
export function setAuditLogService(s: IAuditLogService | null) { auditLogService = s; }

function fireNotification(fn: () => Promise<void>) { fn().catch(() => {}); }
function fireAuditLog(eventType: string, entityType: string, entityId: string, performedBy: string, details?: Record<string, unknown>) {
  if (!auditLogService) return;
  try { auditLogService.log({ eventType, entityType, entityId, performedBy, details }); } catch {}
}

export function generateReferenceCode(): string {
  referenceCounter++;
  const counter = referenceCounter.toString(36).toUpperCase().padStart(4, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CM-${counter}${random}`;
}

async function acquireLock(id: string) { while (sessionLocks.has(id)) { await new Promise((r) => setTimeout(r, 1)); } sessionLocks.add(id); }
function releaseLock(id: string) { sessionLocks.delete(id); }

export async function createBooking(data: BookingRequest & { vpAlias?: string; level?: string; tenure?: string; alias?: string }): Promise<BookingResult> {
  const session = getSession(data.sessionId);
  if (!session) return { status: 'rejected', reason: 'Session not found' };

  await acquireLock(data.sessionId);
  try {
    const bookings = getBookingsStore();
    const duplicate = bookings.find((b) => b.sessionId === data.sessionId && b.email.toLowerCase() === data.email.toLowerCase() && b.status === 'confirmed');
    if (duplicate) return { status: 'rejected', reason: 'You already have a booking for this session' };

    const confirmedForEmail = bookings.filter((b) => b.email.toLowerCase() === data.email.toLowerCase() && b.status === 'confirmed');
    if (confirmedForEmail.length > 0) {
      const existing = confirmedForEmail.map((b) => { const s = getSession(b.sessionId); return s ? { startTime: new Date(`${s.sessionDate}T${s.startTime}Z`) } : null; }).filter((x): x is { startTime: Date } => x !== null);
      if (hasOverlap(existing, new Date(`${session.sessionDate}T${session.startTime}Z`))) {
        return { status: 'rejected', reason: 'You already have a booking within 3 hours of this session' };
      }
    }

    if (session.bookingCount < session.maxAttendees) {
      const booking: Booking = { id: uuidv4(), sessionId: data.sessionId, name: data.name, email: data.email, role: data.role, pf: data.pf, status: 'confirmed', referenceCode: generateReferenceCode(), customFields: (data as any).customFields || null, alias: data.alias || '', vpAlias: data.vpAlias || '', level: data.level || '', tenure: data.tenure || '', attended: false, createdAt: new Date(), cancelledAt: null };
      dmAddBooking(booking);
      session.bookingCount += 1;
      session.slotStatus = deriveSlotStatus(session.bookingCount, getWaitlistForSession(data.sessionId).length, session.maxAttendees);
      if (notificationService) fireNotification(() => notificationService!.sendConfirmation(booking, session));
      fireAuditLog('booking_created', 'booking', booking.id, booking.email, { sessionId: session.id, referenceCode: booking.referenceCode });
      emit({ type: 'booking:created', data: { sessionId: session.id, bookingId: booking.id } });
      emit({ type: 'session:updated', data: { sessionId: session.id, bookingCount: session.bookingCount, slotStatus: session.slotStatus } });
      return { status: 'confirmed', booking };
    } else {
      const entry: WaitlistEntry = { id: uuidv4(), sessionId: data.sessionId, name: data.name, email: data.email, role: data.role, pf: data.pf, createdAt: new Date() };
      dmAddWaitlistEntry(entry);
      session.slotStatus = deriveSlotStatus(session.bookingCount, getWaitlistForSession(data.sessionId).length, session.maxAttendees);
      return { status: 'waitlisted', waitlistEntry: entry };
    }
  } finally { releaseLock(data.sessionId); }
}

export async function cancelBooking(bookingId: string, email: string): Promise<void> {
  const booking = getBookingsStore().find((b) => b.id === bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.email.toLowerCase() !== email.toLowerCase()) throw new Error('You are not authorized to cancel this booking');
  if (booking.status === 'cancelled') throw new Error('This booking has already been cancelled');
  const session = getSession(booking.sessionId);
  if (!session) throw new Error('Session not found');

  await acquireLock(booking.sessionId);
  try {
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    session.bookingCount -= 1;
    if (notificationService) fireNotification(() => notificationService!.sendCancellation(booking, session));
    fireAuditLog('booking_cancelled', 'booking', booking.id, email, { sessionId: session.id });
    emit({ type: 'booking:cancelled', data: { sessionId: session.id, bookingId: booking.id } });

    const waitlist = getWaitlistForSession(booking.sessionId);
    if (waitlist.length > 0) {
      const promoted = waitlist[0];
      dmRemoveWaitlistEntry(promoted.id);
      const promotedBooking: Booking = { id: uuidv4(), sessionId: promoted.sessionId, name: promoted.name, email: promoted.email, role: promoted.role, pf: promoted.pf, status: 'confirmed', referenceCode: generateReferenceCode(), customFields: null, promotedFromWaitlist: true, createdAt: new Date(), cancelledAt: null };
      dmAddBooking(promotedBooking);
      session.bookingCount += 1;
      if (notificationService) fireNotification(() => notificationService!.sendWaitlistPromotion(promotedBooking, session));
      fireAuditLog('waitlist_promoted', 'booking', promotedBooking.id, 'system', { sessionId: session.id, promotedFrom: promoted.id });
    }

    session.slotStatus = deriveSlotStatus(session.bookingCount, getWaitlistForSession(booking.sessionId).length, session.maxAttendees);
    emit({ type: 'session:updated', data: { sessionId: session.id, bookingCount: session.bookingCount, slotStatus: session.slotStatus } });
  } finally { releaseLock(booking.sessionId); }
}

export function getBookingsBySession(sessionId: string): Booking[] { return getBookingsStore().filter((b) => b.sessionId === sessionId && b.status === 'confirmed'); }
export function getBookingsByEmail(email: string): Booking[] { return getBookingsStore().filter((b) => b.email.toLowerCase() === email.toLowerCase()); }
export function searchBookings(query: string): Booking[] { const q = query.toLowerCase(); return getBookingsStore().filter((b) => b.name.toLowerCase().includes(q) || b.email.toLowerCase().includes(q) || b.pf.toLowerCase().includes(q)); }
export function getWaitlistForSession(sessionId: string): WaitlistEntry[] { return getWaitlistStore().filter((w) => w.sessionId === sessionId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); }
export function getAllBookings(): Booking[] { return [...getBookingsStore()]; }
export function getAllWaitlistEntries(): WaitlistEntry[] { return [...getWaitlistStore()]; }

export function getStats() {
  const allSessions = getSessions();
  const bookings = getBookingsStore();
  const totalBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const fullSessions = allSessions.filter((s) => s.bookingCount >= (s.maxAttendees ?? 3)).length;
  const emptySessions = allSessions.filter((s) => s.bookingCount === 0).length;
  return { totalBookings, fullSessions, emptySessions, waitlistCount: getWaitlistStore().length };
}

export function exportBookings(filters?: import('@/models/types').SessionFilter): string {
  const filteredSessions = getSessions(filters);
  const sessionIds = new Set(filteredSessions.map((s) => s.id));
  const sessionMap = new Map(filteredSessions.map((s) => [s.id, s]));
  const filtered = getBookingsStore().filter((b) => sessionIds.has(b.sessionId));

  // Build event and program lookup maps
  const events = getEventsStore();
  const programs = getProgramsStore();
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const programMap = new Map(programs.map((p) => [p.id, p]));

  const header = 'Booking ID,Session Date,Session Time,Name,Email,Role,PF,Booking Timestamp,Status,Program';
  const rows = filtered.map((b) => {
    const s = sessionMap.get(b.sessionId);
    const event = s ? eventMap.get(s.eventId) : undefined;
    const program = event ? programMap.get(event.programId) : undefined;
    const programName = program ? program.name : '';
    return [b.id, s?.sessionDate ?? '', s?.startTime ?? '', esc(b.name), esc(b.email), esc(b.role), esc(b.pf), b.createdAt.toISOString(), b.status, esc(programName)].join(',');
  });
  return [header, ...rows].join('\n');
}

function esc(v: string) { return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v; }

export function gdprDeleteByEmail(email: string) {
  const lowerEmail = email.toLowerCase();
  let bookingsAnonymized = 0, waitlistEntriesAnonymized = 0;
  for (const b of getBookingsStore()) { if (b.email.toLowerCase() === lowerEmail) { b.name = '[DELETED]'; b.email = '[DELETED]'; b.role = '[DELETED]'; b.pf = '[DELETED]'; bookingsAnonymized++; } }
  for (const w of getWaitlistStore()) { if (w.email.toLowerCase() === lowerEmail) { w.name = '[DELETED]'; w.email = '[DELETED]'; w.role = '[DELETED]'; w.pf = '[DELETED]'; waitlistEntriesAnonymized++; } }
  return { bookingsAnonymized, waitlistEntriesAnonymized };
}

export function resetBookingStore() {
  setBookingsStore([]); setWaitlistStore([]); referenceCounter = 0; sessionLocks.clear(); notificationService = null; auditLogService = null;
}
