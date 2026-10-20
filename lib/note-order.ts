import type { NoteDTO } from '@/lib/types';

/** Grid ordering shared by the cloud and guest drivers: pinned first, then the
 *  manual position, then most recently touched. */
export function compareNotes(a: NoteDTO, b: NoteDTO): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return b.updatedAt - a.updatedAt;
}

export function sortNotes(notes: NoteDTO[]): NoteDTO[] {
  return [...notes].sort(compareNotes);
}
