// Program Service — CRUD operations for booking programs
// Feature: booking-platform

import { v4 as uuidv4 } from 'uuid';
import {
  getProgramsStore,
  addProgram,
  persistProgram,
  getEventsStore,
  getSessionsStore,
  getBookingsStore,
  getWaitlistStore,
  setEventsStore,
  setSessionsStore,
  setBookingsStore,
  setWaitlistStore,
} from '@/lib/dataManager';
import type {
  Program,
  CustomFormField,
  ProgramEmailTemplates,
} from '@/models/types';

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateProgramInput {
  name: string;
  logoUrl?: string;
  brandColor: string;
  sessionDurationMinutes: number;   // 30 | 60 | 120 | 180
  slotIntervalMinutes: number;      // 15 | 30 | 60
  maxAttendees: number;             // 1 | 2 | 3 | 5 | 10
  customFormFields: CustomFormField[];
  calendarInviteTitleTemplate?: string;
  emailTemplates?: ProgramEmailTemplates;
}

export interface UpdateProgramInput extends Partial<CreateProgramInput> {
  active?: boolean;
}

// ─── Validation Constants ────────────────────────────────────────────────────

const VALID_SESSION_DURATIONS = [30, 60, 120, 180];
const VALID_SLOT_INTERVALS = [15, 30, 60];
const VALID_MAX_ATTENDEES = [1, 2, 3, 5, 10];
const DEFAULT_CALENDAR_TEMPLATE = '{programName} Session — {userName}';

// ─── Validation ──────────────────────────────────────────────────────────────

function validateProgramInput(input: CreateProgramInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Program name is required');
  }

  if (!VALID_SESSION_DURATIONS.includes(input.sessionDurationMinutes)) {
    throw new Error(
      `Invalid session duration: ${input.sessionDurationMinutes}. Must be one of: ${VALID_SESSION_DURATIONS.join(', ')}`,
    );
  }

  if (!VALID_SLOT_INTERVALS.includes(input.slotIntervalMinutes)) {
    throw new Error(
      `Invalid slot interval: ${input.slotIntervalMinutes}. Must be one of: ${VALID_SLOT_INTERVALS.join(', ')}`,
    );
  }

  if (!VALID_MAX_ATTENDEES.includes(input.maxAttendees)) {
    throw new Error(
      `Invalid max attendees: ${input.maxAttendees}. Must be one of: ${VALID_MAX_ATTENDEES.join(', ')}`,
    );
  }
}

function checkNameUniqueness(name: string, excludeId?: string): void {
  const programs = getProgramsStore();
  const normalizedName = name.trim().toLowerCase();
  const duplicate = programs.find(
    (p) => p.name.toLowerCase() === normalizedName && p.id !== excludeId,
  );
  if (duplicate) {
    throw new Error('A program with this name already exists');
  }
}

// ─── Service Functions ───────────────────────────────────────────────────────

export function createProgram(input: CreateProgramInput): Program {
  validateProgramInput(input);
  checkNameUniqueness(input.name);

  const program: Program = {
    id: uuidv4(),
    name: input.name.trim(),
    logoUrl: input.logoUrl || null,
    brandColor: input.brandColor,
    sessionDurationMinutes: input.sessionDurationMinutes,
    slotIntervalMinutes: input.slotIntervalMinutes,
    maxAttendees: input.maxAttendees,
    customFormFields: input.customFormFields,
    calendarInviteTitleTemplate:
      input.calendarInviteTitleTemplate || DEFAULT_CALENDAR_TEMPLATE,
    emailTemplates: input.emailTemplates || {},
    active: true,
    createdAt: new Date(),
  };

  addProgram(program);
  return program;
}

export function updateProgram(
  programId: string,
  input: UpdateProgramInput,
): Program | null {
  const programs = getProgramsStore();
  const index = programs.findIndex((p) => p.id === programId);
  if (index === -1) return null;

  const existing = programs[index];

  // Validate fields if provided
  if (input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Program name is required');
    }
    checkNameUniqueness(input.name, programId);
  }

  if (
    input.sessionDurationMinutes !== undefined &&
    !VALID_SESSION_DURATIONS.includes(input.sessionDurationMinutes)
  ) {
    throw new Error(
      `Invalid session duration: ${input.sessionDurationMinutes}. Must be one of: ${VALID_SESSION_DURATIONS.join(', ')}`,
    );
  }

  if (
    input.slotIntervalMinutes !== undefined &&
    !VALID_SLOT_INTERVALS.includes(input.slotIntervalMinutes)
  ) {
    throw new Error(
      `Invalid slot interval: ${input.slotIntervalMinutes}. Must be one of: ${VALID_SLOT_INTERVALS.join(', ')}`,
    );
  }

  if (
    input.maxAttendees !== undefined &&
    !VALID_MAX_ATTENDEES.includes(input.maxAttendees)
  ) {
    throw new Error(
      `Invalid max attendees: ${input.maxAttendees}. Must be one of: ${VALID_MAX_ATTENDEES.join(', ')}`,
    );
  }

  const updated: Program = {
    ...existing,
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl || null }),
    ...(input.brandColor !== undefined && { brandColor: input.brandColor }),
    ...(input.sessionDurationMinutes !== undefined && {
      sessionDurationMinutes: input.sessionDurationMinutes,
    }),
    ...(input.slotIntervalMinutes !== undefined && {
      slotIntervalMinutes: input.slotIntervalMinutes,
    }),
    ...(input.maxAttendees !== undefined && {
      maxAttendees: input.maxAttendees,
    }),
    ...(input.customFormFields !== undefined && {
      customFormFields: input.customFormFields,
    }),
    ...(input.calendarInviteTitleTemplate !== undefined && {
      calendarInviteTitleTemplate: input.calendarInviteTitleTemplate,
    }),
    ...(input.emailTemplates !== undefined && {
      emailTemplates: input.emailTemplates,
    }),
    ...(input.active !== undefined && { active: input.active }),
  };

  programs[index] = updated;
  return updated;
}

export function getProgram(programId: string): Program | null {
  const programs = getProgramsStore();
  return programs.find((p) => p.id === programId) || null;
}

export function getPrograms(): Program[] {
  return getProgramsStore();
}

export function getActivePrograms(): Program[] {
  return getProgramsStore().filter((p) => p.active);
}

export function getProgramByName(name: string): Program | null {
  const normalizedName = name.trim().toLowerCase();
  return (
    getProgramsStore().find((p) => p.name.toLowerCase() === normalizedName) ||
    null
  );
}

export function deleteProgram(programId: string): boolean {
  const programs = getProgramsStore();
  const index = programs.findIndex((p) => p.id === programId);
  if (index === -1) return false;
  programs.splice(index, 1);

  // Clean up in-memory events, sessions, bookings, and waitlist for this program
  const events = getEventsStore();
  const programEventIds = new Set(events.filter((e) => e.programId === programId).map((e) => e.id));
  const sessions = getSessionsStore();
  const programSessionIds = new Set(sessions.filter((s) => programEventIds.has(s.eventId)).map((s) => s.id));

  setEventsStore(events.filter((e) => e.programId !== programId));
  setSessionsStore(sessions.filter((s) => !programEventIds.has(s.eventId)));
  setBookingsStore(getBookingsStore().filter((b) => !programSessionIds.has(b.sessionId)));
  setWaitlistStore(getWaitlistStore().filter((w) => !programSessionIds.has(w.sessionId)));

  return true;
}
