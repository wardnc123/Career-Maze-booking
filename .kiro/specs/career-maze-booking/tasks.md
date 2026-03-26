# Implementation Plan: Career Maze Session Booking & Tracking System

## Overview

Build a full-stack Next.js (TypeScript) application with PostgreSQL for managing Career Maze session bookings across a 20-day window (Aug 3–22, 2026). Implementation proceeds bottom-up: database schema → business logic services → API routes → frontend pages → background jobs → integration wiring.

## Tasks

- [x] 1. Set up project structure and database schema
  - [x] 1.1 Initialize Next.js project with TypeScript, install dependencies (pg, bcrypt, ics, fast-check, uuid, nodemailer)
    - Create Next.js app with TypeScript configuration
    - Install runtime dependencies: `pg`, `bcrypt`, `ics`, `uuid`, `nodemailer`
    - Install dev dependencies: `fast-check`, `@types/*` packages, `vitest`
    - Configure `tsconfig.json` path aliases for `@/services`, `@/models`, `@/lib`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Create database migration for all tables (Session, Booking, WaitlistEntry, Admin, AdminSession, AuditLog)
    - Create SQL migration file with all CREATE TABLE statements per the data model
    - Include indexes: `(email, status)` on Booking, `(session_id, status)` on Booking, `(session_id, created_at)` on WaitlistEntry
    - Include unique constraint on `(session_date, start_time)` for Session
    - Include CHECK constraint on `booking_count` (0–3)
    - Include ENUM types for `slot_status` and `booking_status`
    - _Requirements: 1.4, 11.1_

  - [x] 1.3 Create TypeScript type definitions and interfaces
    - Define `Session`, `Booking`, `WaitlistEntry`, `Admin`, `AdminSession`, `AuditLog` types
    - Define `BookingRequest`, `BookingResult`, `SessionFilter`, `SlotStatus`, `CalendarEvent` interfaces
    - Define `DailyStats` interface for digest
    - _Requirements: 3.1, 12.1_

- [x] 2. Implement core business logic services
  - [x] 2.1 Implement `SessionService` — session generation and querying
    - Implement `generateSessions()` producing 360 sessions for Aug 3–22, 2026
    - Generate sessions at :00, :15, :30 for morning (9:00–11:45) and afternoon (14:00–15:15) Europe/London
    - Implement `getSessions()`, `getSession()`, `getSessionsByDate()` with filter support
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Write property test: Session generation produces valid time slots
    - **Property 1: Session generation produces valid time slots**
    - Verify all generated sessions have start_time minutes in {0, 15, 30}, hours in morning/afternoon windows, no lunch break sessions, capacity = 3
    - **Validates: Requirements 1.1, 1.3, 1.4**

  - [x] 2.3 Implement `deriveSlotStatus()` utility function
    - Implement slot status derivation: Available (0), Limited (1–2), Full (3, no waitlist), Waitlisted (3, with waitlist)
    - _Requirements: 2.2_

  - [x] 2.4 Write property test: Slot status derivation
    - **Property 2: Slot status derivation**
    - Use `fc.integer({min:0, max:3})` and `fc.integer({min:0, max:50})` to verify correct status mapping
    - **Validates: Requirements 2.2**

  - [x] 2.5 Implement `hasOverlap()` — 3-hour overlap detection
    - Implement overlap check comparing 3-hour windows for existing bookings vs new session time
    - _Requirements: 1.5, 3.5_

  - [x] 2.6 Write property test: 3-hour overlap detection
    - **Property 3: 3-hour overlap detection**
    - Generate random time pairs, verify overlapping windows are rejected and non-overlapping are allowed
    - **Validates: Requirements 1.5, 3.5**

  - [x] 2.7 Implement `BookingService` — create, cancel, query bookings
    - Implement `createBooking()` with capacity check, overlap check, and waitlist routing
    - Use database-level locking (SELECT FOR UPDATE) to prevent overbooking
    - Implement `cancelBooking()` with status update, count decrement, and waitlist promotion trigger
    - Implement `getBookingsBySession()`, `getBookingsByEmail()`, `searchBookings()`
    - Generate unique reference codes for each booking
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3_

  - [x] 2.8 Write property test: Booking routing by capacity
    - **Property 4: Booking routing by capacity**
    - Verify confirmed when < 3 bookings, waitlisted when = 3 bookings
    - **Validates: Requirements 3.2, 3.3, 4.1**

  - [x] 2.9 Write property test: Booking confirmation contains required fields
    - **Property 8: Booking confirmation contains required fields**
    - Verify confirmation response includes session date, time, and reference code
    - **Validates: Requirements 3.4**

  - [x] 2.10 Implement `WaitlistService` — FIFO waitlist management
    - Implement `addToWaitlist()`, `promoteNext()`, `getWaitlist()`, `removeFromWaitlist()`
    - Ensure FIFO ordering by `created_at` timestamp
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.11 Write property test: Waitlist FIFO ordering
    - **Property 5: Waitlist FIFO ordering**
    - Verify entries ordered by creation timestamp, promotion selects earliest
    - **Validates: Requirements 4.2**

  - [x] 2.12 Write property test: Cancellation decrements count and handles waitlist
    - **Property 6: Cancellation decrements count and frees slot or promotes waitlist**
    - Verify cancel sets status to cancelled, decrements count, promotes waitlist if entries exist
    - **Validates: Requirements 5.1, 5.2, 5.3, 4.3**

- [x] 3. Checkpoint — Core business logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement notification and calendar services
  - [x] 4.1 Implement `CalendarService` — ICS generation and parsing
    - Use `ics` library to generate RFC 5545-compliant `.ics` files
    - Include session date, start time, 3-hour duration, Europe/London timezone
    - Implement `parseIcs()` for round-trip verification
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

  - [x] 4.2 Write property test: Calendar invite round-trip
    - **Property 7: Calendar invite round-trip**
    - Generate ICS then parse back, verify date, start time, duration, and timezone match
    - **Validates: Requirements 6.1, 6.4, 6.5**

  - [x] 4.3 Implement `NotificationService` — email sending with templates
    - Implement `sendConfirmation()` with .ics attachment
    - Implement `sendCancellation()`, `sendWaitlistPromotion()`, `sendReminder()`
    - Implement `sendDailyDigest()` with stats summary
    - Implement retry logic (3 retries with exponential backoff) for email failures
    - Abstract behind interface for testability
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 4.4 Implement `AuditLogService` — logging data operations
    - Create service to log booking creation, cancellation, data access events
    - Store event_type, entity_type, entity_id, details, performed_by
    - _Requirements: 11.4_

  - [x] 4.5 Write property test: Audit logging for data operations
    - **Property 19: Audit logging for data operations**
    - Verify audit log entry created with correct event type, entity reference, and performer for each operation
    - **Validates: Requirements 11.4**

- [x] 5. Implement API routes
  - [x] 5.1 Implement session API routes (`GET /api/sessions`, `GET /api/sessions/:id`)
    - Return sessions with optional filters (date, timeRange, status)
    - No authentication required
    - _Requirements: 12.1_

  - [x] 5.2 Implement booking API routes (`POST /api/bookings`, `DELETE /api/bookings/:id`)
    - Validate required fields (name, email, role, PF), return 400 for invalid input
    - Create booking or add to waitlist, return appropriate response
    - Cancel booking with email verification, return 403 for mismatch
    - Trigger notifications on create/cancel
    - _Requirements: 3.1, 3.2, 5.1, 5.5, 12.1, 12.3_

  - [x] 5.3 Write property test: API validation returns correct error codes
    - **Property 17: API validation returns correct error codes**
    - Verify 400 for invalid/missing params, 401 for unauthenticated protected endpoints
    - **Validates: Requirements 3.1, 12.2, 12.3**

  - [x] 5.4 Write property test: Booking API round-trip
    - **Property 16: Booking API round-trip**
    - Create booking via API, retrieve via API, verify fields match
    - **Validates: Requirements 12.4**

  - [x] 5.5 Implement admin auth routes (`POST /api/auth/login`, `POST /api/auth/logout`)
    - Validate credentials with bcrypt, create/destroy admin sessions
    - Implement 30-minute inactivity timeout check
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 5.6 Write property test: Admin session expiry after inactivity
    - **Property 15: Admin session expiry after inactivity**
    - Verify sessions expired when last_active_at + 30 min < now
    - **Validates: Requirements 10.4**

  - [x] 5.7 Implement admin API routes (`GET /api/admin/stats`, `GET /api/admin/search`, `GET /api/admin/export`)
    - Require session-based authentication, return 401 if unauthenticated
    - Implement stats aggregation (total bookings, full sessions, empty sessions, waitlist count)
    - Implement search by name, email, or PF
    - Implement CSV/Excel export with all required fields
    - _Requirements: 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 12.2_

  - [x] 5.8 Write property test: Summary statistics accuracy
    - **Property 10: Summary statistics accuracy**
    - Verify computed stats match actual booking/waitlist record counts
    - **Validates: Requirements 7.5, 8.4**

  - [x] 5.9 Write property test: Booking search returns matching results
    - **Property 13: Booking search returns matching results**
    - Verify all returned bookings contain query string in name, email, or PF
    - **Validates: Requirements 8.6**

  - [x] 5.10 Write property test: Export contains all required fields
    - **Property 14: Export contains all required fields**
    - Verify export has one row per booking with all required columns
    - **Validates: Requirements 9.1**

  - [x] 5.11 Write property test: Session and booking filtering
    - **Property 12: Session and booking filtering**
    - Verify filtered results satisfy all active filter criteria, no valid results excluded
    - **Validates: Requirements 8.5, 9.2**

  - [x] 5.12 Implement SSE endpoint (`GET /api/events`)
    - Emit `session:updated`, `booking:created`, `booking:cancelled` events
    - Integrate with BookingService to push changes within 5 seconds
    - _Requirements: 2.3, 8.3_

  - [x] 5.13 Implement waitlist API route (`GET /api/waitlist/:sessionId`)
    - Require authentication token
    - Return waitlist entries ordered by creation time
    - _Requirements: 12.1, 12.2_

- [x] 6. Checkpoint — API layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement frontend pages
  - [x] 7.1 Implement Booking Page — calendar view with session grid
    - Display all 360 sessions organized by date
    - Show slot status with color coding (Available, Limited, Full, Waitlisted)
    - Display times in Europe/London timezone
    - Responsive layout for 320px–2560px viewports
    - Connect to SSE for real-time status updates within 5 seconds
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 7.2 Implement booking form and confirmation flow
    - Booking form with Name, Email, Role, PF fields and validation
    - Display confirmation page with session date, time, and booking reference on success
    - Display error messages for overlap conflicts, full sessions, duplicate bookings
    - Waitlist opt-in prompt when session is full
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.1_

  - [x] 7.3 Implement self-service cancellation flow
    - Cancellation mechanism accessible without admin intervention
    - Require email verification for cancellation
    - Display cancellation confirmation
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 7.4 Implement Admin login page
    - Login form with username/password
    - Redirect to dashboard on success, show error on failure
    - Redirect unauthenticated users to login
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 7.5 Implement Admin Dashboard — session grid with real-time indicators
    - Display all 360 sessions in grid/table layout by date and time
    - Color indicators: Green (0–1 bookings), Yellow (2 bookings), Red (3 bookings)
    - Daily summary statistics panel
    - Filter controls for date, time, capacity status
    - Search bar for attendee name, email, or PF
    - Connect to SSE for real-time updates within 5 seconds
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.6 Write property test: Dashboard color indicator mapping
    - **Property 11: Dashboard color indicator mapping**
    - Verify Green for 0–1 bookings, Yellow for 2, Red for 3
    - **Validates: Requirements 8.2**

  - [x] 7.7 Implement Admin export functionality
    - Export button with filter application
    - Download CSV/Excel file within 10 seconds for up to 1,080 records
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 8. Checkpoint — Frontend pages
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement background jobs and data privacy
  - [x] 9.1 Implement reminder job — 24-hour pre-session notifications
    - Select sessions starting within next 24 hours
    - Send reminder email to all confirmed attendees for each selected session
    - _Requirements: 7.4_

  - [x] 9.2 Write property test: Reminder job selects correct sessions and attendees
    - **Property 9: Reminder job selects correct sessions and attendees**
    - Verify only sessions within 24 hours selected, all confirmed attendees targeted
    - **Validates: Requirements 7.4**

  - [x] 9.3 Implement daily digest job — admin summary email
    - Compute daily stats: total bookings, full sessions, empty sessions, waitlist count
    - Send digest to all admin users
    - _Requirements: 7.5_

  - [x] 9.4 Implement GDPR data deletion endpoint
    - Remove personal data (name, email, role, PF) from Bookings and WaitlistEntry records for requesting attendee
    - Process within 30 days
    - _Requirements: 11.3_

  - [x] 9.5 Write property test: GDPR data deletion removes personal data
    - **Property 18: GDPR data deletion removes personal data**
    - Verify no booking or waitlist entry contains attendee's personal data after deletion
    - **Validates: Requirements 11.3**

- [x] 10. Integration wiring and final validation
  - [x] 10.1 Wire NotificationService into BookingService for all trigger points
    - Confirmation email on booking creation
    - Cancellation email on booking cancellation
    - Waitlist promotion email on promotion
    - Ensure all emails sent within 60 seconds
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.2 Wire AuditLogService into all data operations
    - Log booking creation, cancellation, data access, admin actions
    - _Requirements: 11.4_

  - [x] 10.3 Configure HTTPS and encryption at rest
    - Ensure TLS 1.2+ for all connections
    - Configure PostgreSQL column-level encryption for personal data fields
    - _Requirements: 11.1, 11.2_

  - [x] 10.4 Write integration tests for end-to-end booking flow
    - Test: create booking → receive confirmation → cancel → waitlist promotion
    - Test: admin login → view dashboard → search → export
    - _Requirements: 3.2, 5.1, 4.3, 10.1, 9.1_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All property tests use fast-check with minimum 100 iterations per property
