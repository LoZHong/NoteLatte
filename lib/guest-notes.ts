'use client';

import type { NoteDTO, NoteStatus } from '@/lib/types';
import { sortNotes } from '@/lib/note-order';
import type { NoteInput, NotePatch, NotesDriver } from '@/lib/notes-driver';
import { NotesDriverError } from '@/lib/notes-driver';

export const GUEST_STORAGE_KEY = 'notelatte_guest_notes';

const STATUSES: NoteStatus[] = ['Todo', 'In-Progress', 'On-Hold', 'Done'];

/** Used when localStorage is unavailable (private mode, disabled storage), so the
 *  guest workspace still works for the lifetime of the tab. */
let memoryFallback: NoteDTO[] | null = null;

function isStatus(value: unknown): value is NoteStatus {
  return typeof value === 'string' && (STATUSES as string[]).includes(value);
}

function normalizeNote(value: unknown): NoteDTO | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;

  return {
    id: raw.id,
    title: raw.title,
    content: typeof raw.content === 'string' ? raw.content : '',
    status: isStatus(raw.status) ? raw.status : 'Todo',
    isPinned: raw.isPinned === true,
    sortOrder: typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
  };
}

function seedNotes(): NoteDTO[] {
  const now = Date.now();
  return [
    {
      id: 'guest-welcome',
      title: 'Welcome to Guest Mode',
      status: 'Todo',
      content:
        'You are using NoteLatte without an account. Everything you see lives in this browser only.\n\nClick any card to edit it.\nClick the status badge to cycle Todo → In-Progress → On-Hold → Done.\nClick the pin to keep a note at the top.\nDrag the grip handle to reorder.\n\nSign in whenever you want these notes synced across devices.',
      isPinned: true,
      sortOrder: 0,
      updatedAt: now - 1000 * 60 * 2,
    },
    {
      id: 'guest-reading',
      title: 'Weekend reading list',
      status: 'Todo',
      content:
        'The Design of Everyday Things — chapter 4\nA Philosophy of Software Design — ch. 1-3\nNotes on the Neon serverless Postgres docs\n\nPick two, not three.',
      isPinned: false,
      sortOrder: 1,
      updatedAt: now - 1000 * 60 * 35,
    },
    {
      id: 'guest-launch',
      title: 'Launch checklist',
      status: 'In-Progress',
      content:
        '- Draft the announcement post\n- Record a 60 second walkthrough\n- Ask three people for feedback\n- Ship on Thursday morning',
      isPinned: false,
      sortOrder: 2,
      updatedAt: now - 1000 * 60 * 60 * 3,
    },
    {
      id: 'guest-coffee',
      title: 'Coffee order for the team',
      status: 'Done',
      content: 'Two flat whites, one oat cappuccino, one filter. Pick up at 9:15.',
      isPinned: false,
      sortOrder: 3,
      updatedAt: now - 1000 * 60 * 60 * 26,
    },
  ];
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(GUEST_STORAGE_KEY);
  } catch {
    return memoryFallback ? JSON.stringify(memoryFallback) : null;
  }
}

function writeRaw(notes: NoteDTO[]): void {
  memoryFallback = notes;
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Storage full or blocked: the in-memory copy keeps the session usable.
  }
}

/** Reads guest notes, seeding the workspace the first time it is opened.
 *  An intentionally emptied list ([]) is respected — deletions must not resurrect. */
export function readGuestNotes(): NoteDTO[] {
  const raw = readRaw();

  if (raw === null) {
    const seeded = seedNotes();
    writeRaw(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    const notes = parsed.map(normalizeNote).filter((note): note is NoteDTO => note !== null);
    return notes;
  } catch {
    // Corrupted payload: start over rather than trapping the user in an empty shell.
    const seeded = seedNotes();
    writeRaw(seeded);
    return seeded;
  }
}

/** Non-seeding read for signed-in users who may have local notes worth importing. */
export function peekGuestNotes(): NoteDTO[] | null {
  const raw = readRaw();
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const notes = parsed.map(normalizeNote).filter((note): note is NoteDTO => note !== null);
    return notes.length > 0 ? sortNotes(notes) : null;
  } catch {
    return null;
  }
}

export function writeGuestNotes(notes: NoteDTO[]): void {
  writeRaw(notes);
}

export function clearGuestNotes(): void {
  memoryFallback = [];
  try {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest-${crypto.randomUUID()}`;
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Guest driver: same contract as the cloud driver, no network at all. */
export const guestNotesDriver: NotesDriver = {
  mode: 'guest',

  async list() {
    return sortNotes(readGuestNotes());
  },

  async create(input: NoteInput) {
    const notes = readGuestNotes();
    const lowest = notes.reduce((min, note) => Math.min(min, note.sortOrder), 0);

    const note: NoteDTO = {
      id: makeId(),
      title: input.title,
      content: input.content,
      status: input.status,
      isPinned: input.isPinned,
      sortOrder: lowest - 1,
      updatedAt: Date.now(),
    };

    writeGuestNotes([note, ...notes]);
    return note;
  },

  async update(id: string, patch: NotePatch) {
    const notes = readGuestNotes();
    const existing = notes.find((note) => note.id === id);
    if (!existing) {
      throw new NotesDriverError('Note not found.', 404);
    }

    const updated: NoteDTO = { ...existing, ...patch, updatedAt: Date.now() };
    writeGuestNotes(notes.map((note) => (note.id === id ? updated : note)));
    return updated;
  },

  async remove(id: string) {
    const notes = readGuestNotes();
    const remaining = notes.filter((note) => note.id !== id);
    if (remaining.length === notes.length) {
      throw new NotesDriverError('Note not found.', 404);
    }
    writeGuestNotes(remaining);
  },

  async reorder(ids: string[]) {
    const positions = new Map(ids.map((id, index) => [id, index]));
    const notes = readGuestNotes().map((note) =>
      positions.has(note.id) ? { ...note, sortOrder: positions.get(note.id) as number } : note
    );
    writeGuestNotes(notes);
  },
};
