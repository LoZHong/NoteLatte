import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ user: null, error: 'Not authenticated.' }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error('[GET /api/auth/me]', error);
    return NextResponse.json({ user: null, error: 'Could not load your session.' }, { status: 500 });
  }
}
