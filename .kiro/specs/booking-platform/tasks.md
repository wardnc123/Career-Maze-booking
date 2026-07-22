I'# Tasks: Booking Platform

## Task 1: Database Migration & Data Model

- [x] 1.1 Create `Program`, `CustomFormField`, `EmailTemplate`, `ProgramEmailTemplates` types in `src/models/types.ts`
- [x] 1.2 Extend `CareerMazeEvent` type with `programId: string` field
- [x] 1.3 Extend `Session` type with `maxAttendees: number` field (default 3)
- [x] 1.4 Extend `Booking` type with `customFields: Record<string, string> | null` field
- [x] 1.5 Create migration file `src/lib/migrations/003_programs.sql` that creates the `programs` table, adds `program_id` to `events`, `max_attendees` to `sessions`, `custom_fields` to `bookings`, inserts the default Career Maze program, and links existing events
- [x] 1.6 Update `src/lib/db.ts` `initDb()` to create the `programs` table alongside existing tables
- [x] 1.7 Update `src/lib/persistence.ts` to load/save programs, and handle the new columns on events, sessions, and bookings
- [x] 1.8 Update `src/lib/dataManager.ts` to add programs store (`getProgramsStore`, `setProgramsStore`, `addProgram`, `persistProgram`) and load programs in `ensureLoaded()`

## Task 2: Program Service

- [x] 2.1 Create `src/services/programService.ts` with `createProgram`, `updateProgram`, `getProgram`, `getPrograms`, `getActivePrograms`, `getProgramByName` functions
- [x] 2.2 Implement program name uniqueness validation (case-insensitive)
- [x] 2.3 Implement input validation for sessionDurationMinutes (30|60|120|180), slotIntervalMinutes (15|30|60), maxAttendees (1|2|3|5|10)
- [x] 2.4 Implement default calendarInviteTitleTemplate fallback to `"{programName} Session — {userName}"`
- [x] 2.5 Write property tests for program service (Properties 1, 2, 15, 16) in `src/services/__tests__/programService.property.test.ts`

## Task 3: Extend Session & Booking Services

- [x] 3.1 Update `src/services/sessionService.ts` `createEvent` to accept `programId` and `maxAttendees` parameters, set `programId` on event and `maxAttendees` on each generated session
- [x] 3.2 Update `src/lib/slotStatus.ts` `deriveSlotStatus` to accept `maxAttendees` parameter instead of hardcoded 3
- [x] 3.3 Update `src/services/bookingService.ts` `createBooking` to use session's `maxAttendees` instead of hardcoded 3, and store `customFields` on booking
- [x] 3.4 Update `src/services/bookingService.ts` `exportBookings` to include program name column in CSV output
- [x] 3.5 Write property tests for extended services (Properties 3, 4, 5, 6, 7, 10, 11) in `src/services/__tests__/bookingPlatform.property.test.ts`

## Task 4: Calendar Service Extension

- [x] 4.1 Update `src/services/calendarService.ts` `generateIcs` to accept program config (calendarInviteTitleTemplate, sessionDurationMinutes, programName) and use them for summary and duration
- [x] 4.2 Implement template placeholder replacement (`{programName}`, `{userName}`) in calendar invite summary
- [x] 4.3 Include program name in calendar invite description
- [x] 4.4 Write property tests for calendar service (Property 8) in `src/services/__tests__/calendarPlatform.property.test.ts`

## Task 5: Email Template Service

- [x] 5.1 Create `src/services/emailTemplateService.ts` with `renderEmailTemplate`, `getDefaultTemplate`, `validateTemplate`, `renderPreview` functions
- [x] 5.2 Implement placeholder rendering for all supported placeholders ({userName}, {userEmail}, {programName}, {eventTitle}, {sessionDate}, {sessionTime}, {location}, {referenceCode}, {cancelUrl}, {programLogo})
- [x] 5.3 Implement validation that confirmation templates contain required placeholders ({userName}, {sessionDate}, {sessionTime})
- [x] 5.4 Implement default templates for each notification type (confirmation, cancellation, waitlist_promotion, reminder)
- [x] 5.5 Update `src/services/notificationService.ts` to use email template service when program has custom templates, falling back to defaults
- [x] 5.6 Write property tests for email template service (Properties 12, 13, 14) in `src/services/__tests__/emailTemplate.property.test.ts`

## Task 6: Program API Endpoints

- [x] 6.1 Create `src/app/api/programs/route.ts` with GET (list all programs) and POST (create program) handlers
- [x] 6.2 Create `src/app/api/programs/[id]/route.ts` with GET (get program) and PUT (update program) handlers
- [x] 6.3 Create `src/app/api/programs/[id]/logo/route.ts` with POST handler for logo upload via Vercel Blob
- [x] 6.4 Create `src/app/api/programs/[id]/email-templates/preview/route.ts` with POST handler for template preview
- [x] 6.5 Update existing `src/app/api/admin/setup/route.ts` to accept `programId` in POST body and pass it to `createEvent`
- [x] 6.6 Write API route tests in `src/app/api/programs/route.test.ts`

## Task 7: Admin Program Pages

- [x] 7.1 Create `src/app/admin/programs/page.tsx` — admin program landing page showing program cards with name, logo, event count, booking count, active status, and "Create Program" button
- [x] 7.2 Create `src/app/admin/programs/new/page.tsx` — create program form with all fields (name, logo upload, brand color, session duration, slot interval, max attendees, custom form fields, calendar invite template, email templates)
- [x] 7.3 Create `src/app/admin/programs/[programId]/settings/page.tsx` — edit program settings form pre-populated with current values
- [x] 7.4 Create `src/app/admin/programs/[programId]/page.tsx` — scoped event management page (reuse existing admin overview UI filtered by programId)
- [x] 7.5 Update `src/app/admin/page.tsx` to redirect to `/admin/programs`

## Task 8: User-Facing Program Pages

- [x] 8.1 Update `src/app/page.tsx` to show program cards when multiple active programs exist, or redirect to single program's booking page
- [x] 8.2 Create `src/app/programs/[programId]/page.tsx` — program-scoped booking page with program branding (logo, brand color) and event/session listing
- [x] 8.3 Update `src/app/book/[sessionId]/page.tsx` to look up session → event → program and apply program branding and custom form fields to the booking form
- [x] 8.4 Update `src/app/my-bookings/page.tsx` to group bookings by program and display program name/logo per group
- [x] 8.5 Update `src/app/cancel/[bookingId]/page.tsx` to apply the booking's program brand color

## Task 9: Backward Compatibility & Integration

- [x] 9.1 Ensure existing API endpoints (`/api/sessions`, `/api/bookings`, `/api/admin/setup`, etc.) continue to work without `programId` by defaulting to the default program
- [x] 9.2 Ensure existing bookings without `customFields` are handled gracefully (treat as null)
- [x] 9.3 Ensure existing sessions without `maxAttendees` default to 3
- [x] 9.4 Verify SSE events continue to fire for session updates across all programs
- [x] 9.5 Verify GDPR deletion works across all programs
- [x] 9.6 Run existing test suite to confirm no regressions
