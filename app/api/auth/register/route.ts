import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { nameFromEmail, setSessionCookie, signSessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toPublicUser } from '@/lib/serializers';
import { firstIssue, registerSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { email, password, name } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name?.trim() || nameFromEmail(email),
      },
    });

    const token = await signSessionToken({ userId: user.id, email: user.email });
    return setSessionCookie(NextResponse.json({ user: toPublicUser(user) }, { status: 201 }), token);
  } catch (error) {
    // Unique constraint race: two signups for the same email at the same time.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }
    console.error('[POST /api/auth/register]', error);
    return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 });
  }
}
