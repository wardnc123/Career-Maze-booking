import { NextRequest, NextResponse } from 'next/server';
import { getProgram, updateProgram } from '@/services/programService';
import { ensureLoaded, persistProgram } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

/**
 * GET /api/programs/[id] — Get program details
 * Requirements: 11.4
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureLoaded();
  const { id } = await params;

  const program = getProgram(id);
  if (!program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404, headers: noCacheHeaders });
  }

  return NextResponse.json(program, { headers: noCacheHeaders });
}

/**
 * PUT /api/programs/[id] — Update program settings
 * Requirements: 11.3, 11.5
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureLoaded();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: noCacheHeaders });
  }

  const existing = getProgram(id);
  if (!existing) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404, headers: noCacheHeaders });
  }

  try {
    const updated = updateProgram(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404, headers: noCacheHeaders });
    }
    await persistProgram(updated);
    return NextResponse.json(updated, { headers: noCacheHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update program';
    return NextResponse.json({ error: message }, { status: 400, headers: noCacheHeaders });
  }
}
