import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { setSessionCookie, signSessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toPublicUser } from '@/lib/serializers';
import { firstIssue, loginSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Same message for unknown email and wrong password: no account enumeration.
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await signSessionToken({ userId: user.id, email: user.email });
    return setSessionCookie(NextResponse.json({ user: toPublicUser(user) }), token);
  } catch (error) {
    console.error('[POST /api/auth/login]', error);
    return NextResponse.json({ error: 'Could not sign you in.' }, { status: 500 });
  }
}
