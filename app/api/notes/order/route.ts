import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { firstIssue, reorderNotesSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PUT /api/notes/order  { ids: string[] }
 *
 * Persists the manual grid order. `ids` is the caller's full visible list; each id
 * gets `sortOrder = index`. Ownership is checked before writing, so a foreign id in
 * the array fails the whole request instead of silently doing nothing.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = reorderNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { ids } = parsed.data;

  try {
    const owned = await prisma.note.count({
      where: { id: { in: ids }, userId: session.userId },
    });
    if (owned !== ids.length) {
      return NextResponse.json({ error: 'One or more notes were not found.' }, { status: 404 });
    }

    // Raw UPDATE on purpose: `update()` would bump `updatedAt` through @updatedAt and
    // make every dragged card claim it was edited "just now".
    await prisma.$transaction(
      ids.map(
        (id, index) =>
          prisma.$executeRaw`UPDATE "notes" SET "sortOrder" = ${index} WHERE "id" = ${id} AND "userId" = ${session.userId}`
      )
    );

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (error) {
    console.error('[PUT /api/notes/order]', error);
    return NextResponse.json({ error: 'Could not save the new order.' }, { status: 500 });
  }
}
