import type { NoteDTO, NoteStatus } from '@/lib/types';
import { sortNotes } from '@/lib/note-order';

export type NoteInput = {
  title: string;
  content: string;
  status: NoteStatus;
  isPinned: boolean;
};

export type NotePatch = {
  title?: string;
  content?: string;
  status?: NoteStatus;
  isPinned?: boolean;
};

/** Drivers throw this so the page can distinguish a dead session (401) from a
 *  normal failure without parsing strings. */
export class NotesDriverError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'NotesDriverError';
    this.status = status;
  }
}

export interface NotesDriver {
  readonly mode: 'cloud' | 'guest';
  list(): Promise<NoteDTO[]>;
  create(input: NoteInput): Promise<NoteDTO>;
  update(id: string, patch: NotePatch): Promise<NoteDTO>;
  remove(id: string): Promise<void>;
  reorder(ids: string[]): Promise<void>;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(path: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new NotesDriverError(await readErrorMessage(response, fallbackError), response.status);
  }

  return (await response.json()) as T;
}

/** Logged-in driver: everything goes through the authenticated API routes. */
export const cloudNotesDriver: NotesDriver = {
  mode: 'cloud',

  async list() {
    const data = await request<{ notes: NoteDTO[] }>('/api/notes', { method: 'GET' }, 'Could not load your notes.');
    return data.notes;
  },

  async create(input) {
    const data = await request<{ note: NoteDTO }>(
      '/api/notes',
      { method: 'POST', body: JSON.stringify(input) },
      'Could not create the note.'
    );
    return data.note;
  },

  async update(id, patch) {
    const data = await request<{ note: NoteDTO }>(
      `/api/notes/${id}`,
      { method: 'PUT', body: JSON.stringify(patch) },
      'Could not update the note.'
    );
    return data.note;
  },

  async remove(id) {
    await request<{ ok: boolean }>(
      `/api/notes/${id}`,
      { method: 'DELETE' },
      'Could not delete the note.'
    );
  },

  async reorder(ids) {
    await request<{ ok: boolean }>(
      '/api/notes/order',
      { method: 'PUT', body: JSON.stringify({ ids }) },
      'Could not save the new order.'
    );
  },
};

export { sortNotes };
