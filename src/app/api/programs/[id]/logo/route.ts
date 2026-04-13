import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getProgram, updateProgram } from '@/services/programService';
import { ensureLoaded, persistProgram } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

/**
 * POST /api/programs/[id]/logo — Upload program logo via Vercel Blob
 * Requirements: 3.3
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

  try {
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No logo file provided' }, { status: 400, headers: noCacheHeaders });
    }

    const blob = await put(`program-logos/${id}/${file.name}`, file, {
      access: 'public',
    });

    const updated = updateProgram(id, { logoUrl: blob.url });
    if (updated) {
      await persistProgram(updated);
    }

    return NextResponse.json({ logoUrl: blob.url }, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    console.error('[logo upload] Error:', err);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500, headers: noCacheHeaders });
  }
}
