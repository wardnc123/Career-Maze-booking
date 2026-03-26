// Career Maze Session Booking & Tracking System — Reminder Job
// Sends 24-hour pre-session reminder emails to all confirmed attendees.
// Requirements: 7.4

import { getSessions } from '@/services/sessionService';
import { getBookingsBySession } from '@/services/bookingService';
import type { NotificationService } from '@/services/notificationService';

/**
 * Run the reminder job: find sessions starting within the next 24 hours
 * and send reminder emails to all confirmed attendees.
 *
 * @param notificationService - The notification service instance to use for sending reminders
 * @param now - Optional "now" timestamp for testability (defaults to current time)
 * @returns Summary of how many reminders were sent
 */
export async function runReminderJob(
  notificationService: NotificationService,
  now?: Date
): Promise<{ remindersSent: number; sessionsProcessed: number }> {
  const currentTime = now ?? new Date();
  const twentyFourHoursLater = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);

  const allSessions = getSessions();

  // Filter sessions starting within the next 24 hours
  const upcomingSessions = allSessions.filter((session) => {
    const sessionStart = new Date(`${session.sessionDate}T${session.startTime}Z`);
    return sessionStart > currentTime && sessionStart <= twentyFourHoursLater;
  });

  let remindersSent = 0;

  for (const session of upcomingSessions) {
    const confirmedBookings = getBookingsBySession(session.id);

    for (const booking of confirmedBookings) {
      await notificationService.sendReminder(booking, session);
      remindersSent++;
    }
  }

  return {
    remindersSent,
    sessionsProcessed: upcomingSessions.length,
  };
}
