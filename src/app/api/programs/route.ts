import { NextRequest, NextResponse } from 'next/server';
import { createProgram, getPrograms } from '@/services/programService';
import { ensureLoaded, persistProgram } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';
import type { CreateProgramInput } from '@/services/programService';

/**
 * GET /api/programs — List all programs
 * Requirements: 11.1
 */
export async function GET() {
  await ensureLoaded();
  return NextResponse.json(getPrograms(), { headers: noCacheHeaders });
}

/**
 * POST /api/programs — Create a new program
 * Requirements: 11.2, 11.5
 */
export async function POST(request: NextRequest) {
  await ensureLoaded();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: noCacheHeaders });
  }

  const {
    name, brandColor, sessionDurationMinutes, slotIntervalMinutes,
    maxAttendees, customFormFields, calendarInviteTitleTemplate,
    emailTemplates, logoUrl,
  } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Program name is required' }, { status: 400, headers: noCacheHeaders });
  }
  if (!brandColor || typeof brandColor !== 'string') {
    return NextResponse.json({ error: 'Brand color is required' }, { status: 400, headers: noCacheHeaders });
  }

  const input: CreateProgramInput = {
    name: name.trim(),
    brandColor: brandColor as string,
    sessionDurationMinutes: sessionDurationMinutes as number,
    slotIntervalMinutes: slotIntervalMinutes as number,
    maxAttendees: maxAttendees as number,
    customFormFields: (customFormFields as CreateProgramInput['customFormFields']) || [],
    ...(calendarInviteTitleTemplate && { calendarInviteTitleTemplate: calendarInviteTitleTemplate as string }),
    ...(emailTemplates && { emailTemplates: emailTemplates as CreateProgramInput['emailTemplates'] }),
    ...(logoUrl && { logoUrl: logoUrl as string }),
  };

  try {
    const program = createProgram(input);
    await persistProgram(program);
    return NextResponse.json(program, { status: 201, headers: noCacheHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create program';
    return NextResponse.json({ error: message }, { status: 400, headers: noCacheHeaders });
  }
}
