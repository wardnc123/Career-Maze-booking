import { NextRequest, NextResponse } from 'next/server';
import { ensureLoaded } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';
import { runReminderJob } from '@/services/reminderJob';
import { NotificationService, createNodemailerTransport } from '@/services/notificationService';

/**
 * GET /api/cron/reminders — Triggered by Vercel Cron or manually
 * Sends reminder emails to all attendees with sessions in the next 24 hours.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret if set (optional security for the cron endpoint)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureLoaded();

  // Check if SMTP is configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    return NextResponse.json(
      { error: 'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.' },
      { status: 500, headers: noCacheHeaders },
    );
  }

  const transport = createNodemailerTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: parseInt(smtpPort, 10) === 465,
    auth: { user: smtpUser, pass: smtpPass },
    from: smtpFrom,
  });

  const notificationService = new NotificationService(transport);

  try {
    const result = await runReminderJob(notificationService);
    return NextResponse.json(
      { message: 'Reminders sent', ...result },
      { headers: noCacheHeaders },
    );
  } catch (err) {
    console.error('[cron/reminders] Error:', err);
    return NextResponse.json(
      { error: 'Failed to send reminders', detail: String(err) },
      { status: 500, headers: noCacheHeaders },
    );
  }
}

/**
 * POST /api/cron/reminders — Manual trigger from admin UI
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
