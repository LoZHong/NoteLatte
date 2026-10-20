import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toNoteDTO } from '@/lib/serializers';
import { createNoteSchema, firstIssue } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const notes = await prisma.note.findMany({
      where: { userId: session.userId },
      // Pinned notes first, then manual order, then most recently touched.
      orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    return NextResponse.json({ notes: notes.map(toNoteDTO) });
  } catch (error) {
    console.error('[GET /api/notes]', error);
    return NextResponse.json({ error: 'Could not load your notes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  try {
    // New notes go to the top of their group: one below the current minimum.
    const note = await prisma.$transaction(async (tx) => {
      const lowest = await tx.note.aggregate({
        where: { userId: session.userId },
        _min: { sortOrder: true },
      });

      return tx.note.create({
        data: {
          title: parsed.data.title,
          content: parsed.data.content,
          status: parsed.data.status,
          isPinned: parsed.data.isPinned,
          sortOrder: (lowest._min.sortOrder ?? 0) - 1,
          userId: session.userId,
        },
      });
    });
    return NextResponse.json({ note: toNoteDTO(note) }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/notes]', error);
    return NextResponse.json({ error: 'Could not create the note.' }, { status: 500 });
  }
}
