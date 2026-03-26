# Requirements Document

## Introduction

The Career Maze Session Booking & Tracking System is a web-based application that enables attendees to self-register for Career Maze sessions, automatically manages calendar invites, enforces capacity limits, and provides administrators with a real-time tracking dashboard. The system covers a 20-day period (August 3–22, 2026) with 18 time slots per day (360 total sessions), each supporting up to 3 attendees. The goal is to eliminate manual invite checking and provide a seamless booking experience across mobile and desktop devices.

## Glossary

- **Booking_System**: The web-based application that manages session registration, capacity, notifications, and administration
- **Attendee**: A person who registers for a Career Maze session through the public booking page
- **Admin**: An authenticated administrator who manages and monitors sessions via the dashboard
- **Session**: A single bookable time slot identified by a date and start time, with a fixed capacity of 3 attendees
- **Booking**: A confirmed registration linking an Attendee to a Session, including name, email, role, and PF
- **Waitlist_Entry**: A queued registration for a full Session, ordered by timestamp
- **Calendar_Invite**: An .ics file attachment sent via email representing the booked Session
- **Slot_Status**: The availability state of a Session: Available (0 bookings), Limited (1–2 bookings), Full (3 bookings), or Waitlisted (3 bookings with waitlist entries)
- **PF**: Performance Factor — a required attendee field captured during booking
- **Booking_Page**: The public-facing web page where Attendees view availability and register for Sessions
- **Admin_Dashboard**: The authenticated web interface where Admins monitor and manage all Sessions and Bookings
- **Daily_Digest**: An automated email sent to Admins summarizing the day's capacity overview
- **Notification_Service**: The component responsible for sending all automated emails (confirmations, cancellations, waitlist alerts, reminders, digests)

## Requirements

### Requirement 1: Session Schedule Configuration

**User Story:** As an admin, I want the system to enforce a fixed session schedule, so that sessions are only available during designated time windows.

#### Acceptance Criteria

1. THE Booking_System SHALL generate Sessions at 15-minute intervals (:00, :15, :30) for each hour within the morning window (9:00 AM – 11:45 AM Europe/London) and the afternoon window (2:00 PM – 3:15 PM Europe/London), excluding :45 slots
2. THE Booking_System SHALL generate Sessions for each day in the date range August 3–22, 2026 (inclusive), producing 18 Sessions per day and 360 Sessions total
3. THE Booking_System SHALL NOT generate Sessions during the lunch break window (12:00 PM – 1:59 PM Europe/London)
4. WHEN a Session is created, THE Booking_System SHALL set the session capacity to exactly 3 attendees
5. WHEN an Attendee books a Session, THE Booking_System SHALL block a 3-hour window starting from the selected Session start time, preventing the Attendee from booking overlapping Sessions

### Requirement 2: Public Booking Page

**User Story:** As an attendee, I want to see available time slots on a calendar view, so that I can choose a convenient session to book.

#### Acceptance Criteria

1. THE Booking_Page SHALL display a calendar view showing all Sessions within the date range August 3–22, 2026
2. THE Booking_Page SHALL display each Session with its current Slot_Status: Available (0 bookings), Limited (1–2 bookings), Full (3 bookings), or Waitlisted (3 bookings with waitlist entries)
3. WHEN the Slot_Status of a Session changes, THE Booking_Page SHALL reflect the updated status within 5 seconds
4. THE Booking_Page SHALL render correctly on viewports ranging from 320px to 2560px wide (mobile through desktop)
5. THE Booking_Page SHALL display all times in the Europe/London timezone

### Requirement 3: Booking Registration

**User Story:** As an attendee, I want to register for a Career Maze session by providing my details, so that I can secure my spot.

#### Acceptance Criteria

1. WHEN an Attendee submits a booking, THE Booking_System SHALL require the following fields: Name, Email, Role, and PF
2. WHEN an Attendee submits a booking for a Session with fewer than 3 confirmed Bookings, THE Booking_System SHALL create a confirmed Booking and associate it with the Session
3. WHEN a confirmed Booking is created, THE Booking_System SHALL increment the Session's current booking count by 1
4. WHEN a Booking is successfully created, THE Booking_System SHALL display a confirmation page to the Attendee showing the session date, time, and booking reference
5. WHEN an Attendee submits a booking with an email address that already has a confirmed Booking for an overlapping 3-hour window, THE Booking_System SHALL reject the booking and display an error message indicating the time conflict

### Requirement 4: Waitlist Management

**User Story:** As an attendee, I want to join a waitlist when a session is full, so that I can be notified if a spot opens up.

#### Acceptance Criteria

1. WHEN an Attendee submits a booking for a Session that has 3 confirmed Bookings, THE Booking_System SHALL add the Attendee to the Waitlist_Entry queue for that Session
2. THE Booking_System SHALL order Waitlist_Entry records by waitlist timestamp (first-come, first-served)
3. WHEN a confirmed Booking is cancelled and a Waitlist_Entry exists for that Session, THE Booking_System SHALL promote the earliest Waitlist_Entry to a confirmed Booking
4. WHEN a Waitlist_Entry is promoted to a confirmed Booking, THE Notification_Service SHALL send a confirmation email with a Calendar_Invite to the promoted Attendee within 60 seconds

### Requirement 5: Booking Cancellation

**User Story:** As an attendee, I want to cancel my booking and free up the slot for others, so that the session capacity is accurately maintained.

#### Acceptance Criteria

1. WHEN an Attendee requests cancellation of a confirmed Booking, THE Booking_System SHALL set the Booking status to "cancelled"
2. WHEN a Booking is cancelled, THE Booking_System SHALL decrement the Session's current booking count by 1
3. WHEN a Booking is cancelled, THE Booking_System SHALL make the freed slot available for new Bookings or promote the next Waitlist_Entry
4. WHEN a Booking is cancelled, THE Notification_Service SHALL send a cancellation confirmation email to the Attendee within 60 seconds
5. THE Booking_Page SHALL provide a self-service cancellation mechanism accessible to the Attendee without requiring Admin intervention

### Requirement 6: Calendar Invite Generation

**User Story:** As an attendee, I want to receive an automatic calendar invite when I book, so that the session appears in my calendar.

#### Acceptance Criteria

1. WHEN a Booking is confirmed, THE Notification_Service SHALL generate a Calendar_Invite in .ics format containing the session date, start time, 3-hour duration, and session details
2. WHEN a Calendar_Invite is generated, THE Notification_Service SHALL send it as an email attachment to the Attendee's registered email address within 60 seconds of booking confirmation
3. THE Calendar_Invite SHALL be compatible with Outlook and Microsoft 365 calendar systems
4. THE Calendar_Invite SHALL specify the Europe/London timezone for the session start and end times
5. FOR ALL confirmed Bookings, generating a Calendar_Invite then importing it into a calendar application SHALL produce an event matching the original Session date, start time, and 3-hour duration (round-trip property)

### Requirement 7: Automated Email Notifications

**User Story:** As an attendee, I want to receive timely email notifications about my booking status, so that I stay informed without manual follow-up.

#### Acceptance Criteria

1. WHEN a Booking is confirmed, THE Notification_Service SHALL send a confirmation email with the Calendar_Invite to the Attendee's email address within 60 seconds
2. WHEN a Booking is cancelled, THE Notification_Service SHALL send a cancellation confirmation email to the Attendee's email address within 60 seconds
3. WHEN a Waitlist_Entry is promoted to a confirmed Booking, THE Notification_Service SHALL send a notification email with a Calendar_Invite to the Attendee's email address within 60 seconds
4. WHEN a Session is scheduled to occur within 24 hours, THE Notification_Service SHALL send a reminder email to each Attendee with a confirmed Booking for that Session
5. THE Notification_Service SHALL send a Daily_Digest email to all Admins containing the total bookings count, full sessions count, empty sessions count, and waitlist count for the current day

### Requirement 8: Admin Dashboard — Real-Time Session Overview

**User Story:** As an admin, I want to see real-time capacity across all 360 sessions, so that I can monitor utilization without checking individual invites.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display all 360 Sessions in a grid or table layout organized by date and time
2. THE Admin_Dashboard SHALL display each Session with a visual color indicator: Green (0–1 bookings), Yellow (2 bookings), Red (3 bookings / full)
3. WHEN a Booking or cancellation occurs, THE Admin_Dashboard SHALL update the affected Session's visual indicator within 5 seconds
4. THE Admin_Dashboard SHALL display daily summary statistics: total bookings, full sessions, empty sessions, and waitlist count
5. THE Admin_Dashboard SHALL provide filter controls for date, time, and capacity status (Available, Limited, Full)
6. THE Admin_Dashboard SHALL provide search functionality allowing Admins to search Bookings by attendee name, email, or PF

### Requirement 9: Admin Data Export

**User Story:** As an admin, I want to export all booking data for analysis, so that I can generate reports outside the system.

#### Acceptance Criteria

1. WHEN an Admin requests an export, THE Admin_Dashboard SHALL generate a file in CSV or Excel format containing all Booking details: booking ID, session date, session time, attendee name, email, role, PF, booking timestamp, and status
2. THE Admin_Dashboard SHALL allow Admins to filter Bookings before export, applying the same date, time, and capacity status filters available in the dashboard view
3. WHEN an export is generated, THE Admin_Dashboard SHALL initiate a file download to the Admin's browser within 10 seconds for datasets up to 1,080 records (360 sessions × 3 attendees)

### Requirement 10: Admin Authentication

**User Story:** As an admin, I want the dashboard to be protected by authentication, so that only authorized personnel can access booking data.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to access the Admin_Dashboard, THE Booking_System SHALL redirect the user to an authentication page
2. WHEN an Admin provides valid credentials, THE Booking_System SHALL grant access to the Admin_Dashboard
3. IF an Admin provides invalid credentials, THEN THE Booking_System SHALL display an error message and deny access to the Admin_Dashboard
4. WHEN an Admin session has been inactive for 30 minutes, THE Booking_System SHALL terminate the session and require re-authentication

### Requirement 11: Data Storage and Privacy

**User Story:** As an admin, I want attendee data to be stored securely and in compliance with GDPR, so that the organization meets its data protection obligations.

#### Acceptance Criteria

1. THE Booking_System SHALL store all attendee personal data (name, email, role, PF) in encrypted form at rest
2. THE Booking_System SHALL transmit all data over HTTPS (TLS 1.2 or higher)
3. WHEN an Attendee requests deletion of their personal data, THE Booking_System SHALL remove all associated personal data from Bookings and Waitlist_Entry records within 30 days
4. THE Booking_System SHALL log all data access and modification events for audit purposes

### Requirement 12: API Endpoints

**User Story:** As a developer, I want API endpoints for core booking operations, so that future integrations can interact with the system programmatically.

#### Acceptance Criteria

1. THE Booking_System SHALL expose RESTful API endpoints for: listing Sessions, creating a Booking, cancelling a Booking, listing Bookings, and querying Waitlist_Entry records
2. THE Booking_System SHALL require authentication tokens for all API endpoints that access or modify Booking data
3. WHEN an API request contains invalid or missing parameters, THE Booking_System SHALL return an appropriate HTTP error status code (400 for bad request, 401 for unauthorized, 404 for not found) with a descriptive error message
4. FOR ALL valid Booking creation API requests, creating a Booking via the API then retrieving it via the API SHALL return a Booking object matching the original request data (round-trip property)
