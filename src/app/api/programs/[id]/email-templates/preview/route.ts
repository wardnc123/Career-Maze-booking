import { NextRequest, NextResponse } from 'next/server';
import { getProgram } from '@/services/programService';
import { renderPreview } from '@/services/emailTemplateService';
import { ensureLoaded } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';
import type { EmailTemplate } from '@/models/types';

/**
 * POST /api/programs/[id]/email-templates/preview — Preview email template
 * Requirements: 13.6
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureLoaded();
  const { id } = await params;

  const program = getProgram(id);
  if (!program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404, headers: noCacheHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: noCacheHeaders });
  }

  const template = body.template as EmailTemplate | undefined;
  if (!template || !template.subject || !template.bodyHtml) {
    return NextResponse.json(
      { error: 'Template with subject and bodyHtml is required' },
      { status: 400, headers: noCacheHeaders },
    );
  }

  try {
    const preview = renderPreview(template, program.brandColor);
    return NextResponse.json(preview, { headers: noCacheHeaders });
  } catch (err) {
    console.error('[email-templates/preview] Error:', err);
    return NextResponse.json({ error: 'Failed to render preview' }, { status: 500, headers: noCacheHeaders });
  }
}
