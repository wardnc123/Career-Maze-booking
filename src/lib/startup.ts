// Career Maze — Application startup wiring
// Connects NotificationService to BookingService when SMTP is configured.

import { setNotificationService } from '@/services/bookingService';
import {
  NotificationService,
  createNodemailerTransport,
} from '@/services/notificationService';

let wired = false;

/**
 * Wire up production services (notification emails, etc).
 * Safe to call multiple times — only runs once.
 */
export function wireServices(): void {
  if (wired) return;
  wired = true;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    console.log('[startup] SMTP not configured — emails disabled. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to enable.');
    return;
  }

  const transport = createNodemailerTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: parseInt(smtpPort, 10) === 465,
    auth: { user: smtpUser, pass: smtpPass },
    from: smtpFrom,
  });

  const notificationService = new NotificationService(transport);
  setNotificationService(notificationService);

  console.log(`[startup] Email notifications enabled via ${smtpHost}`);
}
