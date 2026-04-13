// Career Maze Session Booking & Tracking System — NotificationService
// Handles all outbound email communications with retry logic and .ics attachments.

import type { Booking, Session, DailyStats, Program } from '@/models/types';
import { generateIcs } from '@/services/calendarService';
import {
  renderEmailTemplate,
  getDefaultTemplate,
  type NotificationType,
} from '@/services/emailTemplateService';

// ─── Email Transport Interface ───────────────────────────────────────────────

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export interface EmailTransport {
  sendMail(message: EmailMessage): Promise<void>;
}

// ─── NotificationService Interface ───────────────────────────────────────────

export interface INotificationService {
  sendConfirmation(booking: Booking, session: Session): Promise<void>;
  sendCancellation(booking: Booking, session: Session): Promise<void>;
  sendWaitlistPromotion(booking: Booking, session: Session): Promise<void>;
  sendReminder(booking: Booking, session: Session): Promise<void>;
  sendDailyDigest(stats: DailyStats): Promise<void>;
}

// ─── Retry Configuration ─────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// ─── NotificationService Implementation ──────────────────────────────────────

export class NotificationService implements INotificationService {
  private transport: EmailTransport;
  private adminEmails: string[];
  private program: Program | null;

  constructor(transport: EmailTransport, adminEmails: string[] = [], program?: Program | null) {
    this.transport = transport;
    this.adminEmails = adminEmails;
    this.program = program ?? null;
  }

  /**
   * Build placeholder values from booking and session data.
   */
  private buildPlaceholders(booking: Booking, session: Session): Record<string, string> {
    return {
      userName: booking.name,
      userEmail: booking.email,
      programName: this.program?.name ?? 'Career Maze',
      eventTitle: this.program?.name ?? 'Career Maze',
      sessionDate: session.sessionDate,
      sessionTime: session.startTime,
      location: '',
      referenceCode: booking.referenceCode,
      cancelUrl: `/cancel/${booking.id}`,
      programLogo: this.program?.logoUrl ?? '',
    };
  }

  /**
   * Render email using program template or fall back to hardcoded default.
   */
  private renderForType(
    type: NotificationType,
    booking: Booking,
    session: Session,
  ): { subject: string; html: string } | null {
    const brandColor = this.program?.brandColor ?? '#1a1a2e';
    const customTemplate = this.program?.emailTemplates?.[type];

    if (customTemplate) {
      const placeholders = this.buildPlaceholders(booking, session);
      try {
        return renderEmailTemplate(customTemplate, placeholders, brandColor);
      } catch {
        // Fall back to default template on render failure (per error handling spec)
      }
    }

    // If program exists but has no custom template, use default template service
    if (this.program) {
      const defaultTemplate = getDefaultTemplate(type);
      const placeholders = this.buildPlaceholders(booking, session);
      return renderEmailTemplate(defaultTemplate, placeholders, brandColor);
    }

    // No program — return null to use legacy hardcoded templates
    return null;
  }

  /**
   * Send booking confirmation email with .ics calendar attachment.
   * Requirements: 7.1, 6.1, 6.2
   */
  async sendConfirmation(booking: Booking, session: Session): Promise<void> {
    let icsContent: string | null = null;
    try {
      icsContent = generateIcs(booking, session);
    } catch {
      // ICS generation failure: send email without attachment, per error handling spec
    }

    const rendered = this.renderForType('confirmation', booking, session);

    const message: EmailMessage = rendered
      ? { to: booking.email, subject: rendered.subject, html: rendered.html }
      : {
          to: booking.email,
          subject: `Booking Confirmed — Career Maze Session on ${session.sessionDate}`,
          html: `
        <h2>Booking Confirmed</h2>
        <p>Hi ${booking.name},</p>
        <p>Your Career Maze session has been confirmed.</p>
        <ul>
          <li><strong>Date:</strong> ${session.sessionDate}</li>
          <li><strong>Time:</strong> ${session.startTime}</li>
          <li><strong>Reference:</strong> ${booking.referenceCode}</li>
        </ul>
        <p>A calendar invite is attached to this email.</p>
      `,
        };

    if (icsContent) {
      message.attachments = [
        {
          filename: 'career-maze-session.ics',
          content: icsContent,
          contentType: 'text/calendar',
        },
      ];
    }

    await this.sendWithRetry(message);
  }

  /**
   * Send cancellation confirmation email.
   * Requirements: 7.2
   */
  async sendCancellation(booking: Booking, session: Session): Promise<void> {
    const rendered = this.renderForType('cancellation', booking, session);

    const message: EmailMessage = rendered
      ? { to: booking.email, subject: rendered.subject, html: rendered.html }
      : {
          to: booking.email,
          subject: `Booking Cancelled — Career Maze Session on ${session.sessionDate}`,
          html: `
        <h2>Booking Cancelled</h2>
        <p>Hi ${booking.name},</p>
        <p>Your Career Maze session booking has been cancelled.</p>
        <ul>
          <li><strong>Date:</strong> ${session.sessionDate}</li>
          <li><strong>Time:</strong> ${session.startTime}</li>
          <li><strong>Reference:</strong> ${booking.referenceCode}</li>
        </ul>
        <p>If this was a mistake, you can rebook from the booking page.</p>
      `,
        };

    await this.sendWithRetry(message);
  }

  /**
   * Send waitlist promotion notification with .ics calendar attachment.
   * Requirements: 7.3, 4.4
   */
  async sendWaitlistPromotion(booking: Booking, session: Session): Promise<void> {
    let icsContent: string | null = null;
    try {
      icsContent = generateIcs(booking, session);
    } catch {
      // ICS generation failure: send email without attachment
    }

    const rendered = this.renderForType('waitlist_promotion', booking, session);

    const message: EmailMessage = rendered
      ? { to: booking.email, subject: rendered.subject, html: rendered.html }
      : {
          to: booking.email,
          subject: `You're In! Career Maze Session on ${session.sessionDate}`,
          html: `
        <h2>Waitlist Promotion</h2>
        <p>Hi ${booking.name},</p>
        <p>A spot has opened up and your booking is now confirmed!</p>
        <ul>
          <li><strong>Date:</strong> ${session.sessionDate}</li>
          <li><strong>Time:</strong> ${session.startTime}</li>
          <li><strong>Reference:</strong> ${booking.referenceCode}</li>
        </ul>
        <p>A calendar invite is attached to this email.</p>
      `,
        };

    if (icsContent) {
      message.attachments = [
        {
          filename: 'career-maze-session.ics',
          content: icsContent,
          contentType: 'text/calendar',
        },
      ];
    }

    await this.sendWithRetry(message);
  }

  /**
   * Send 24-hour reminder email.
   * Requirements: 7.4
   */
  async sendReminder(booking: Booking, session: Session): Promise<void> {
    const rendered = this.renderForType('reminder', booking, session);

    const message: EmailMessage = rendered
      ? { to: booking.email, subject: rendered.subject, html: rendered.html }
      : {
          to: booking.email,
          subject: `Reminder: Career Maze Session Tomorrow — ${session.sessionDate}`,
          html: `
        <h2>Session Reminder</h2>
        <p>Hi ${booking.name},</p>
        <p>This is a reminder that your Career Maze session is coming up tomorrow.</p>
        <ul>
          <li><strong>Date:</strong> ${session.sessionDate}</li>
          <li><strong>Time:</strong> ${session.startTime}</li>
          <li><strong>Reference:</strong> ${booking.referenceCode}</li>
        </ul>
        <p>See you there!</p>
      `,
        };

    await this.sendWithRetry(message);
  }

  /**
   * Send daily digest email to all admins with stats summary.
   * Requirements: 7.5
   */
  async sendDailyDigest(stats: DailyStats): Promise<void> {
    const message: EmailMessage = {
      to: '', // will be set per admin
      subject: `Daily Digest — Career Maze Bookings for ${stats.date}`,
      html: `
        <h2>Daily Booking Digest</h2>
        <p>Here is the booking summary for ${stats.date}:</p>
        <ul>
          <li><strong>Total Bookings:</strong> ${stats.totalBookings}</li>
          <li><strong>Full Sessions:</strong> ${stats.fullSessions}</li>
          <li><strong>Empty Sessions:</strong> ${stats.emptySessions}</li>
          <li><strong>Waitlist Count:</strong> ${stats.waitlistCount}</li>
        </ul>
      `,
    };

    for (const adminEmail of this.adminEmails) {
      await this.sendWithRetry({ ...message, to: adminEmail });
    }
  }

  /**
   * Send an email with retry logic: 3 retries with exponential backoff.
   * Delays: 500ms, 1000ms, 2000ms between retries.
   */
  private async sendWithRetry(message: EmailMessage): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.transport.sendMail(message);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    throw lastError!;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Nodemailer Transport Adapter ────────────────────────────────────────────

/**
 * Creates an EmailTransport backed by a nodemailer transporter.
 * Use this in production; tests should inject a mock transport.
 */
export function createNodemailerTransport(config: {
  host: string;
  port: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  from: string;
}): EmailTransport {
  // Dynamic import to avoid requiring nodemailer in test environments
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? false,
    auth: config.auth,
  });

  return {
    async sendMail(message: EmailMessage): Promise<void> {
      await transporter.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
    },
  };
}
