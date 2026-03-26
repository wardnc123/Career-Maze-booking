// Career Maze Session Booking & Tracking System — Daily Digest Job
// Sends a daily summary email to all admin users with booking statistics.
// Requirements: 7.5

import { getStats } from '@/services/bookingService';
import type { INotificationService } from '@/services/notificationService';
import type { DailyStats } from '@/models/types';

/**
 * Run the daily digest job: compute current booking stats and send
 * a digest email to all admin users via the notification service.
 *
 * @param notificationService - The notification service instance to use for sending the digest
 * @returns The DailyStats that were sent
 */
export async function runDigestJob(
  notificationService: INotificationService
): Promise<DailyStats> {
  const { totalBookings, fullSessions, emptySessions, waitlistCount } = getStats();

  const stats: DailyStats = {
    date: new Date().toISOString().split('T')[0],
    totalBookings,
    fullSessions,
    emptySessions,
    waitlistCount,
  };

  await notificationService.sendDailyDigest(stats);

  return stats;
}
