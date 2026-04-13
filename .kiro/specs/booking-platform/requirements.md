# Requirements Document

## Introduction

The Booking Platform extends the existing Career Maze booking tool into a generic, multi-program booking system. Administrators can create and configure multiple programs (e.g. Career Maze, Tech Talks, 1:1 Coaching), each with its own branding, session settings, and custom booking form fields. The existing Career Maze functionality becomes the first program instance. Users browse active programs, book sessions within them, and manage bookings across all programs. The platform retains the existing Vercel + Neon Postgres stack and preserves all current features (event creation, booking, cancellation, admin overview, CSV export, calendar invites, waitlist).

## Glossary

- **Platform**: The overall multi-program booking system that hosts one or more Programs.
- **Program**: A configurable booking context (e.g. "Career Maze", "Tech Talks") with its own name, branding, session settings, and form fields. Each Program contains zero or more Events.
- **Event**: A scheduled occurrence within a Program, consisting of dates and time slots that generate Sessions. Corresponds to the existing `CareerMazeEvent` entity.
- **Session**: A single bookable time slot within an Event. Corresponds to the existing `Session` entity.
- **Booking**: A confirmed reservation by a User for a specific Session. Corresponds to the existing `Booking` entity.
- **Waitlist_Entry**: A queued reservation request when a Session is full. Corresponds to the existing `WaitlistEntry` entity.
- **Admin**: An authenticated administrator who manages Programs and Events.
- **User**: A person who browses Programs, books Sessions, and manages their Bookings.
- **Brand_Color**: A hex color code (e.g. `#1a1a2e`) used to theme a Program's UI and calendar invites.
- **Session_Duration**: The length of a single session in a Program (e.g. 30 minutes, 1 hour, 2 hours, 3 hours).
- **Slot_Interval**: The time gap between consecutive session start times within an Event (e.g. every 15 minutes, every 30 minutes, every 1 hour).
- **Max_Attendees**: The maximum number of confirmed Bookings allowed per Session in a Program (e.g. 1, 2, 3, 5, 10). Replaces the current hardcoded limit of 3.
- **Custom_Form_Field**: An additional input field on the booking form beyond the default name and email fields, defined per Program.
- **Calendar_Invite_Title_Template**: A string template used to generate the calendar invite summary for Bookings in a Program, supporting placeholders like `{programName}`, `{userName}`.
- **Email_Template**: A configurable HTML email template for a specific notification type (confirmation, cancellation, waitlist promotion, reminder) within a Program. Supports placeholders for dynamic content.
- **Default_Program**: The automatically created Program instance that migrates the existing Career Maze data and settings.
- **Program_Logo**: An image (uploaded by Admin) displayed in the Program's header and landing page card.

## Requirements

### Requirement 1: Program Data Model

**User Story:** As an Admin, I want each program to have its own configurable settings, so that different booking contexts can operate independently within the same platform.

#### Acceptance Criteria

1. THE Platform SHALL store each Program with the following attributes: unique identifier, name, logo image URL, Brand_Color, Session_Duration, Slot_Interval, Max_Attendees, Custom_Form_Fields definition, Calendar_Invite_Title_Template, active status, and creation timestamp.
2. THE Platform SHALL associate each Event with exactly one Program through a program identifier foreign key.
3. WHEN the Platform is deployed for the first time after migration, THE Platform SHALL create a Default_Program with name "Career Maze", Brand_Color "#1a1a2e", Session_Duration 3 hours, Slot_Interval 15 minutes, Max_Attendees 3, and default form fields (name, email, role, pf).
4. WHEN the Default_Program is created, THE Platform SHALL associate all existing Events with the Default_Program.
5. THE Platform SHALL enforce that each Program name is unique across the Platform.

### Requirement 2: Admin Program Landing Page

**User Story:** As an Admin, I want to see all programs displayed as cards on a landing page, so that I can quickly navigate to manage any program.

#### Acceptance Criteria

1. WHEN the Admin navigates to the admin landing page, THE Platform SHALL display each Program as a card showing the Program name, Program_Logo, number of Events, total Bookings count, and active status.
2. WHEN the Admin clicks a Program card, THE Platform SHALL navigate to the existing event management UI scoped to that Program.
3. THE Platform SHALL display a "Create Program" button on the admin landing page.
4. WHEN only one Program exists, THE Platform SHALL still display the landing page with that single Program card.

### Requirement 3: Program Creation

**User Story:** As an Admin, I want to create a new program with custom settings, so that I can set up different booking contexts for different use cases.

#### Acceptance Criteria

1. WHEN the Admin submits the create program form, THE Platform SHALL validate that the program name is non-empty and unique.
2. WHEN the Admin submits the create program form, THE Platform SHALL accept and store the following fields: program name, logo image file, Brand_Color, Session_Duration (selectable from 30 minutes, 1 hour, 2 hours, 3 hours), Slot_Interval (selectable from 15 minutes, 30 minutes, 1 hour), Max_Attendees (selectable from 1, 2, 3, 5, 10), Custom_Form_Fields definitions, and Calendar_Invite_Title_Template.
3. WHEN the Admin uploads a logo image, THE Platform SHALL store the image and associate the resulting URL with the Program.
4. WHEN the Admin does not provide a Calendar_Invite_Title_Template, THE Platform SHALL use the default template "{programName} Session — {userName}".
5. IF the program name already exists, THEN THE Platform SHALL display an error message "A program with this name already exists" and retain the form data.

### Requirement 4: Program Settings Editing

**User Story:** As an Admin, I want to edit a program's settings after creation, so that I can update branding, session parameters, or form fields as needs change.

#### Acceptance Criteria

1. WHEN the Admin opens the program settings page, THE Platform SHALL pre-populate all fields with the current Program configuration.
2. WHEN the Admin submits updated program settings, THE Platform SHALL validate and persist the changes.
3. WHEN the Admin changes Max_Attendees for a Program, THE Platform SHALL apply the new limit only to Sessions created after the change; existing Sessions SHALL retain their original Max_Attendees value.
4. WHEN the Admin changes the Brand_Color, THE Platform SHALL apply the new color to all future page renders for that Program.
5. IF the Admin changes the program name to one that already exists, THEN THE Platform SHALL display an error message and retain the form data.

### Requirement 5: Scoped Event Management

**User Story:** As an Admin, I want the existing event management UI to work within the context of a selected program, so that events, sessions, and attendees are managed per program.

#### Acceptance Criteria

1. WHEN the Admin views the event management UI for a Program, THE Platform SHALL display only Events belonging to that Program.
2. WHEN the Admin creates a new Event within a Program, THE Platform SHALL associate the Event with that Program and generate Sessions using the Program's Slot_Interval.
3. WHEN the Admin views session details, THE Platform SHALL display the Max_Attendees value from the Program as the capacity for each Session.
4. WHEN the Admin exports bookings as CSV, THE Platform SHALL include the Program name as a column in the export.
5. THE Platform SHALL preserve all existing event management features (create events, view overview, manage attendees, export CSV) within the scoped Program context.

### Requirement 6: User Program Landing Page

**User Story:** As a User, I want to see all active programs on the landing page, so that I can choose which program to book a session in.

#### Acceptance Criteria

1. WHEN the User navigates to the landing page, THE Platform SHALL display all Programs with active status as cards showing the Program name, Program_Logo, and a brief description.
2. WHEN only one active Program exists, THE Platform SHALL automatically redirect the User to that Program's event listing page.
3. WHEN the User clicks a Program card, THE Platform SHALL navigate to the event listing page for that Program.
4. THE Platform SHALL apply each Program's Brand_Color to its card on the landing page.

### Requirement 7: Program-Scoped Booking Flow

**User Story:** As a User, I want the booking form and experience to reflect the selected program's settings, so that each program feels like a distinct branded experience.

#### Acceptance Criteria

1. WHEN the User views the booking page for a Session within a Program, THE Platform SHALL display the Program_Logo and apply the Program's Brand_Color to the page header and action buttons.
2. WHEN the User views the booking form, THE Platform SHALL display the default fields (name, email) and all Custom_Form_Fields defined for the Program.
3. WHEN the User submits a booking, THE Platform SHALL store the Custom_Form_Field values alongside the standard booking data.
4. WHEN a Session reaches the Program's Max_Attendees count, THE Platform SHALL mark the Session as Full and offer waitlist registration.
5. THE Platform SHALL enforce the same overlap detection rules across all Programs for the same User email address.

### Requirement 8: Program-Branded Calendar Invites

**User Story:** As a User, I want calendar invites to reflect the program's branding and title template, so that I can easily identify which program a session belongs to.

#### Acceptance Criteria

1. WHEN the Platform generates a calendar invite for a Booking, THE Platform SHALL use the Program's Calendar_Invite_Title_Template to set the event summary, replacing `{programName}` with the Program name and `{userName}` with the Booking attendee name.
2. WHEN the Platform generates a calendar invite, THE Platform SHALL use the Program's Session_Duration to set the event duration instead of the hardcoded 3-hour value.
3. WHEN the Platform generates a calendar invite, THE Platform SHALL include the Program name in the event description.

### Requirement 9: Cross-Program Booking Management

**User Story:** As a User, I want to view and cancel my bookings across all programs from a single page, so that I can manage all my reservations in one place.

#### Acceptance Criteria

1. WHEN the User navigates to the My Bookings page, THE Platform SHALL display all confirmed Bookings for the User's email address across all Programs, grouped by Program name.
2. WHEN the User views a booking entry, THE Platform SHALL display the Program name, Program_Logo, Event title, Session date, Session time, and reference code.
3. WHEN the User cancels a Booking, THE Platform SHALL follow the existing cancellation flow including waitlist promotion within the same Session.
4. WHEN the User navigates to the cancellation page, THE Platform SHALL apply the Brand_Color of the Booking's Program to the page.

### Requirement 10: Database Migration

**User Story:** As a developer, I want a database migration that adds the programs table and links existing data, so that the platform upgrade is non-destructive.

#### Acceptance Criteria

1. THE Platform SHALL create a `programs` table with columns for id, name, logo_url, brand_color, session_duration_minutes, slot_interval_minutes, max_attendees, custom_form_fields (JSONB), calendar_invite_title_template, active status, and created_at timestamp.
2. THE Platform SHALL add a `program_id` column to the `events` table as a foreign key referencing the `programs` table.
3. WHEN the migration runs, THE Platform SHALL insert the Default_Program row and set the `program_id` of all existing Event rows to the Default_Program identifier.
4. THE Platform SHALL add a `custom_fields` JSONB column to the `bookings` table to store Custom_Form_Field values.
5. IF the migration encounters an error, THEN THE Platform SHALL roll back all changes and report the error.

### Requirement 11: API Program Endpoints

**User Story:** As a developer, I want RESTful API endpoints for program CRUD operations, so that the frontend can manage programs.

#### Acceptance Criteria

1. WHEN a GET request is made to the programs list endpoint, THE Platform SHALL return all Programs with their configuration.
2. WHEN a POST request is made to the programs endpoint with valid data, THE Platform SHALL create a new Program and return the created Program object.
3. WHEN a PUT request is made to a specific program endpoint with valid data, THE Platform SHALL update the Program and return the updated Program object.
4. WHEN a GET request is made to a specific program endpoint, THE Platform SHALL return the Program configuration including all settings.
5. IF a request contains invalid data (missing name, duplicate name, invalid Session_Duration), THEN THE Platform SHALL return a 400 status code with a descriptive error message.

### Requirement 12: Backward Compatibility

**User Story:** As a developer, I want the platform upgrade to preserve all existing functionality, so that current Career Maze users experience no disruption.

#### Acceptance Criteria

1. THE Platform SHALL continue to support all existing API endpoints with their current request and response formats.
2. WHEN the Platform serves existing Career Maze bookings, THE Platform SHALL display them with the Default_Program's branding and settings.
3. THE Platform SHALL maintain the existing waitlist promotion logic within each Program's Sessions.
4. THE Platform SHALL maintain the existing real-time SSE updates for session availability changes across all Programs.
5. THE Platform SHALL maintain the existing GDPR deletion functionality across all Programs.

### Requirement 13: Customizable Email Templates

**User Story:** As an Admin, I want to control the style, format, and content of emails sent to attendees, so that each program's communications match its branding and messaging.

#### Acceptance Criteria

1. THE Platform SHALL store per-Program Email_Templates for each notification type: booking confirmation, booking cancellation, waitlist promotion, and session reminder.
2. WHEN the Admin creates or edits a Program, THE Platform SHALL provide an email template editor for each notification type, allowing the Admin to set the email subject line, body content (with rich text formatting), and header/footer styling.
3. THE Platform SHALL support the following placeholders in Email_Templates: `{userName}`, `{userEmail}`, `{programName}`, `{eventTitle}`, `{sessionDate}`, `{sessionTime}`, `{location}`, `{referenceCode}`, `{cancelUrl}`, and `{programLogo}`.
4. WHEN the Platform sends a notification email, THE Platform SHALL render the Email_Template by replacing all placeholders with the actual booking and session data, and apply the Program's Brand_Color to the email header and action buttons.
5. WHEN the Admin does not customize an Email_Template, THE Platform SHALL use a default template that includes the Program name, session details, reference code, and cancel link.
6. THE Platform SHALL provide a "Preview" function in the email template editor that renders the template with sample data so the Admin can see how the email will look before saving.
7. THE Platform SHALL validate that all required placeholders (`{userName}`, `{sessionDate}`, `{sessionTime}`) are present in the confirmation Email_Template before saving.
