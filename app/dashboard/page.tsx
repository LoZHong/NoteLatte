'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  NotebookPen,
  Search,
  Plus,
  Pencil,
  Trash2,
  Clock,
  FileText,
  LogOut,
  ChevronDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/auth-context';
import type { NoteDTO as Note, NoteStatus as Status } from '@/lib/types';

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

const STATUS_ORDER: Status[] = ['Todo', 'In-Progress', 'On-Hold', 'Done'];

const STATUS_STYLES: Record<Status, string> = {
  Todo: 'bg-neutral-100 text-neutral-700',
  'In-Progress': 'bg-blue-50 text-blue-700',
  'On-Hold': 'bg-amber-50 text-amber-700',
  Done: 'bg-emerald-50 text-emerald-700',
};

const STATUS_DOT: Record<Status, string> = {
  Todo: 'bg-neutral-400',
  'In-Progress': 'bg-blue-500',
  'On-Hold': 'bg-amber-500',
  Done: 'bg-emerald-500',
};

const FILTERS: ('All' | Status)[] = ['All', ...STATUS_ORDER];

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, signOut, refreshUser } = useAuth();

  const [notes, setNotes] = React.useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<'All' | Status>('All');
  const [search, setSearch] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [status, setStatus] = React.useState<Status>('Todo');
  const [content, setContent] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

  const loadNotes = React.useCallback(async () => {
    setNotesLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/notes', {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (response.status === 401) {
        await refreshUser();
        return;
      }
      if (!response.ok) {
        setLoadError(await readError(response, 'Could not load your notes.'));
        return;
      }

      const data = (await response.json()) as { notes: Note[] };
      setNotes(data.notes);
    } catch {
      setLoadError('Could not load your notes.');
    } finally {
      setNotesLoading(false);
    }
  }, [refreshUser]);

  React.useEffect(() => {
    if (!user) return;
    void loadNotes();
  }, [user, loadNotes]);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setStatus('Todo');
    setContent('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setStatus(note.status);
    setContent(note.content);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || saving) return;

    setSaving(true);
    setFormError(null);

    try {
      const payload = { title: trimmedTitle, status, content: content.trim() };
      const response = await fetch(editingId ? `/api/notes/${editingId}` : '/api/notes', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      if (response.status === 401) {
        await refreshUser();
        return;
      }
      if (!response.ok) {
        setFormError(await readError(response, 'Could not save the note.'));
        return;
      }

      const data = (await response.json()) as { note: Note };
      setNotes((prev) =>
        editingId
          ? prev.map((n) => (n.id === data.note.id ? data.note : n))
          : [data.note, ...prev]
      );
      setModalOpen(false);
    } catch {
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = notes;
    setLoadError(null);
    setNotes((prev) => prev.filter((n) => n.id !== id));

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      if (response.status === 401) {
        await refreshUser();
        return;
      }
      // 404 means it is already gone — the UI is already correct.
      if (!response.ok && response.status !== 404) {
        setNotes(snapshot);
        setLoadError(await readError(response, 'Could not delete that note.'));
      }
    } catch {
      setNotes(snapshot);
      setLoadError('Could not delete that note.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const filteredNotes = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => (activeFilter === 'All' ? true : n.status === activeFilter))
      .filter((n) => (q ? n.title.toLowerCase().includes(q) : true))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, activeFilter, search]);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = { All: notes.length };
    for (const s of STATUS_ORDER) {
      map[s] = notes.filter((n) => n.status === s).length;
    }
    return map;
  }, [notes]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50/60 text-neutral-400">
        <NotebookPen className="h-6 w-6 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50/60 text-neutral-900">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
              <NotebookPen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">NoteLatte</h1>
              <p className="text-xs text-neutral-500">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'} · organized your way
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-3 sm:mx-6 sm:max-w-md sm:flex-none sm:justify-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes by title..."
                className="h-10 bg-white pl-9 text-sm shadow-sm"
              />
            </div>
            <Button
              onClick={openCreate}
              className="h-10 shrink-0 bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">New Note</span>
              <span className="sm:hidden">New</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-2 shadow-sm transition-colors hover:bg-neutral-100"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-neutral-900 text-xs font-medium text-white">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-neutral-900">{user.name}</span>
                    <span className="truncate text-xs text-neutral-500">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Filter bar */}
        <div className="mt-7 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f;
            const count = counts[f] ?? 0;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100'
                )}
              >
                {f}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                    isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loadError && (
          <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
        )}

        {/* Notes grid */}
        {notesLoading && notes.length === 0 ? (
          <div className="mt-16 flex items-center justify-center text-neutral-400">
            <NotebookPen className="h-6 w-6 animate-pulse" />
          </div>
        ) : filteredNotes.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredNotes.map((note) => (
              <article
                key={note.id}
                className="group relative flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">
                    {note.title}
                  </h3>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                      STATUS_STYLES[note.status]
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[note.status])} />
                    {note.status}
                  </span>
                </div>

                <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-neutral-600">
                  {note.content || 'No additional content.'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                    <Clock className="h-3.5 w-3.5" />
                    Updated {formatRelativeTime(note.updatedAt)}
                  </span>

                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      onClick={() => openEdit(note)}
                      aria-label="Edit note"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      aria-label="Delete note"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <FileText className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-neutral-900">No notes found</h3>
            <p className="mt-1 max-w-xs text-sm text-neutral-500">
              {search
                ? `Nothing matches "${search}". Try a different search term.`
                : activeFilter === 'All'
                ? 'Create your first note to get started.'
                : `No notes with status "${activeFilter}".`}
            </p>
            <Button
              onClick={openCreate}
              className="mt-4 bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Note
            </Button>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit note' : 'Create a new note'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the title, status, and content of your note.'
                : 'Add a title, set a status, and jot down your thoughts.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q4 Planning Notes"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger id="note-status" className="w-full">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[s])} />
                        {s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note here..."
                rows={5}
                className="resize-none"
              />
            </div>

            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="border-neutral-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
