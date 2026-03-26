import { NextResponse } from 'next/server';
import { getDbUrl } from '@/lib/db';
import { noCacheHeaders } from '@/lib/apiHeaders';

export async function GET() {
  const dbUrl = getDbUrl();
  const envVars = {
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    DATABASE_URL: !!process.env.DATABASE_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
  };

  let dbStatus = 'no URL configured';
  if (dbUrl) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);
      const result = await sql`SELECT COUNT(*) as count FROM events`;
      dbStatus = `connected, ${result[0].count} events in database`;
    } catch (err) {
      dbStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({ envVars, dbStatus, dbUrlFound: !!dbUrl }, { headers: noCacheHeaders });
}
