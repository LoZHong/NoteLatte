import type { Note, User } from '@prisma/client';

import type { NoteDTO, NoteStatus, PublicUser } from '@/lib/types';

export function toNoteDTO(note: Note): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    status: note.status as NoteStatus,
    content: note.content,
    updatedAt: note.updatedAt.getTime(),
  };
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}
