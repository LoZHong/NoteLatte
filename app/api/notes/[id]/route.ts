import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toNoteDTO } from '@/lib/serializers';
import { firstIssue, updateNoteSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

/**
 * Every query below includes `userId` in the WHERE clause. That is the whole
 * IDOR defence: a note belonging to another account is indistinguishable from
 * a note that does not exist.
 */
export async function PUT(request: Request, { params }: RouteContext) {
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

  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  try {
    const result = await prisma.note.updateMany({
      where: { id: params.id, userId: session.userId },
      data: parsed.data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    }

    const note = await prisma.note.findFirst({
      where: { id: params.id, userId: session.userId },
    });
    if (!note) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    }

    return NextResponse.json({ note: toNoteDTO(note) });
  } catch (error) {
    console.error('[PUT /api/notes/:id]', error);
    return NextResponse.json({ error: 'Could not update the note.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const result = await prisma.note.deleteMany({
      where: { id: params.id, userId: session.userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/notes/:id]', error);
    return NextResponse.json({ error: 'Could not delete the note.' }, { status: 500 });
  }
}
