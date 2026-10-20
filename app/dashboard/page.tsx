'use client';

import * as React from 'react';
import Link from 'next/link';
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
  Pin,
  PinOff,
  GripVertical,
  HardDrive,
  Upload,
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
import { compareNotes } from '@/lib/note-order';
import { cloudNotesDriver, NotesDriverError } from '@/lib/notes-driver';
import {
  clearGuestNotes,
  guestNotesDriver,
  peekGuestNotes,
} from '@/lib/guest-notes';

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

/** Badge click advances the status in this order, wrapping back to Todo. */
const NEXT_STATUS: Record<Status, Status> = {
  Todo: 'In-Progress',
  'In-Progress': 'On-Hold',
  'On-Hold': 'Done',
  Done: 'Todo',
};

function byGridOrder(a: Note, b: Note): number {
  return compareNotes(a, b);
}

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

  const isGuest = !user;

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

  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const lastDragEndRef = React.useRef(0);
  const patchSeqRef = React.useRef<Record<string, number>>({});

  const [importableGuestNotes, setImportableGuestNotes] = React.useState<Note[] | null>(null);
  const [importing, setImporting] = React.useState(false);

  // One component, two storage drivers: the API when a session exists, localStorage otherwise.
  const driver = user ? cloudNotesDriver : guestNotesDriver;

  const loadNotes = React.useCallback(async () => {
    setNotesLoading(true);
    setLoadError(null);
    try {
      setNotes(await driver.list());
    } catch (error) {
      if (error instanceof NotesDriverError && error.status === 401) {
        await refreshUser();
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'Could not load your notes.');
    } finally {
      setNotesLoading(false);
    }
  }, [driver, refreshUser]);

  React.useEffect(() => {
    if (isLoading) return;
    void loadNotes();
  }, [isLoading, loadNotes]);

  // Signed in with guest notes still sitting in this browser: offer to import them once.
  React.useEffect(() => {
    if (isLoading || !user) return;
    setImportableGuestNotes(peekGuestNotes());
  }, [isLoading, user]);

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
      if (editingId) {
        const updated = await driver.update(editingId, {
          title: trimmedTitle,
          status,
          content: content.trim(),
        });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } else {
        const created = await driver.create({
          title: trimmedTitle,
          status,
          content: content.trim(),
          isPinned: false,
        });
        setNotes((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (error) {
      if (error instanceof NotesDriverError && error.status === 401) {
        await refreshUser();
        return;
      }
      setFormError(error instanceof Error ? error.message : 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = notes;
    setLoadError(null);
    setNotes((prev) => prev.filter((n) => n.id !== id));

    try {
      await driver.remove(id);
    } catch (error) {
      if (error instanceof NotesDriverError && error.status === 401) {
        await refreshUser();
        return;
      }
      // 404 means it is already gone — the UI is already correct.
      if (error instanceof NotesDriverError && error.status === 404) return;

      setNotes(snapshot);
      setLoadError(error instanceof Error ? error.message : 'Could not delete that note.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  /**
   * Optimistic single-field update (status cycle / pin toggle).
   * Each note keeps a request sequence so an out-of-order response for an
   * earlier click cannot overwrite the newer state.
   */
  const patchNote = async (note: Note, patch: { status?: Status; isPinned?: boolean }) => {
    const seq = (patchSeqRef.current[note.id] ?? 0) + 1;
    patchSeqRef.current[note.id] = seq;

    setLoadError(null);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...patch } : n)));

    const rollback = () => {
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, status: note.status, isPinned: note.isPinned } : n))
      );
    };

    try {
      const updated = await driver.update(note.id, patch);
      if (patchSeqRef.current[note.id] !== seq) return;
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (error) {
      if (error instanceof NotesDriverError && error.status === 401) {
        await refreshUser();
        return;
      }
      rollback();
      setLoadError(error instanceof Error ? error.message : 'Could not update the note.');
    }
  };

  const cycleStatus = (note: Note) => {
    void patchNote(note, { status: NEXT_STATUS[note.status] });
  };

  const togglePin = (note: Note) => {
    void patchNote(note, { isPinned: !note.isPinned });
  };

  /* Drag-and-drop reordering. Only the unfiltered grid is reorderable, because
     "index in the visible subset" has no stable meaning once a filter is applied. */
  const canReorder = activeFilter === 'All' && search.trim() === '';

  const handleDragStart = (event: React.DragEvent<HTMLElement>, note: Note) => {
    if (!canReorder) {
      event.preventDefault();
      return;
    }
    setDraggingId(note.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', note.id);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>, note: Note) => {
    if (!draggingId || note.id === draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverId !== note.id) setDragOverId(note.id);
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>, target: Note) => {
    event.preventDefault();
    const sourceId = draggingId ?? event.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDragOverId(null);

    if (!sourceId || sourceId === target.id || !canReorder) return;

    const current = filteredNotes;
    const from = current.findIndex((n) => n.id === sourceId);
    const to = current.findIndex((n) => n.id === target.id);
    if (from < 0 || to < 0) return;

    const reordered = [...current];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const previous = notes;
    const positions = new Map(reordered.map((n, index) => [n.id, index]));
    setNotes((prev) =>
      prev.map((n) => (positions.has(n.id) ? { ...n, sortOrder: positions.get(n.id) as number } : n))
    );
    setLoadError(null);

    try {
      await driver.reorder(reordered.map((n) => n.id));
    } catch (error) {
      if (error instanceof NotesDriverError && error.status === 401) {
        await refreshUser();
        return;
      }
      setNotes(previous);
      setLoadError(error instanceof Error ? error.message : 'Could not save the new order.');
    }
  };

  /** Moves notes left behind by Guest Mode into the signed-in account. */
  const handleImportGuestNotes = async () => {
    if (!importableGuestNotes || importing) return;

    setImporting(true);
    setLoadError(null);
    try {
      const imported: Note[] = [];
      for (const note of importableGuestNotes) {
        imported.push(
          await cloudNotesDriver.create({
            title: note.title,
            content: note.content,
            status: note.status,
            isPinned: note.isPinned,
          })
        );
      }

      setNotes((prev) => [...imported, ...prev]);
      clearGuestNotes();
      setImportableGuestNotes(null);
    } catch (error) {
      if (error instanceof NotesDriverError && error.status === 401) {
        await refreshUser();
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'Could not import your guest notes.');
    } finally {
      setImporting(false);
    }
  };

  const filteredNotes = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => (activeFilter === 'All' ? true : n.status === activeFilter))
      .filter((n) => (q ? n.title.toLowerCase().includes(q) : true))
      .sort(byGridOrder);
  }, [notes, activeFilter, search]);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = { All: notes.length };
    for (const s of STATUS_ORDER) {
      map[s] = notes.filter((n) => n.status === s).length;
    }
    return map;
  }, [notes]);

  if (isLoading) {
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
          <Link
            href="/"
            aria-label="Back to the NoteLatte home page"
            className="flex w-fit items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
              <NotebookPen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">NoteLatte</h1>
              <p className="text-xs text-neutral-500">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'} · organized your way
              </p>
            </div>
          </Link>

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

            {user ? (
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
            ) : (
              <Button
                variant="outline"
                onClick={() => router.push('/auth')}
                className="h-10 shrink-0 border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
              >
                Sign In
              </Button>
            )}
          </div>
        </header>

        {isGuest && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Guest Mode: Notes are stored in your browser&apos;s Local Storage (Single Device only).
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Clearing your browser data or cache will permanently erase them.
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/auth')}
              className="h-9 shrink-0 bg-amber-900 text-white hover:bg-amber-800"
            >
              Sign In to Sync Across Devices
            </Button>
          </div>
        )}

        {user && importableGuestNotes && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Upload className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <p className="text-sm text-neutral-700">
                You have {importableGuestNotes.length}{' '}
                {importableGuestNotes.length === 1 ? 'note' : 'notes'} from Guest Mode saved in this
                browser. Import them into your account?
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setImportableGuestNotes(null)}
                className="h-9 border-neutral-200"
              >
                Dismiss
              </Button>
              <Button
                onClick={handleImportGuestNotes}
                disabled={importing}
                className="h-9 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import notes'}
              </Button>
            </div>
          </div>
        )}

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
                role="button"
                tabIndex={0}
                aria-label={`Open note: ${note.title}`}
                draggable={canReorder}
                onDragStart={(event) => handleDragStart(event, note)}
                onDragOver={(event) => handleDragOver(event, note)}
                onDragLeave={() => setDragOverId((current) => (current === note.id ? null : current))}
                onDrop={(event) => void handleDrop(event, note)}
                onDragEnd={() => {
                  lastDragEndRef.current = Date.now();
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                onClick={() => {
                  // A drag ends with a click in some browsers; don't open the modal then.
                  if (Date.now() - lastDragEndRef.current < 250) return;
                  openEdit(note);
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openEdit(note);
                  }
                }}
                className={cn(
                  'group relative flex cursor-pointer flex-col rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
                  note.isPinned
                    ? 'border-neutral-300 bg-neutral-50/50 shadow-md ring-1 ring-neutral-900/[0.04]'
                    : 'border-neutral-200 bg-white',
                  draggingId === note.id && 'opacity-40',
                  dragOverId === note.id && 'ring-2 ring-neutral-900/20'
                )}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">
                    {note.title}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        cycleStatus(note);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      aria-label={`Status: ${note.status}. Click to advance to ${NEXT_STATUS[note.status]}.`}
                      title={`Click to change status (next: ${NEXT_STATUS[note.status]})`}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 active:scale-95',
                        STATUS_STYLES[note.status]
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[note.status])} />
                      {note.status}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePin(note);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                      aria-pressed={note.isPinned}
                      title={note.isPinned ? 'Unpin note' : 'Pin note'}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
                        note.isPinned
                          ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                          : 'text-neutral-300 opacity-0 hover:bg-neutral-100 hover:text-neutral-700 group-hover:opacity-100 max-sm:opacity-100'
                      )}
                    >
                      {note.isPinned ? (
                        <Pin className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <PinOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="mt-2.5 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-600">
                  {note.content || 'No additional content.'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                    <Clock className="h-3.5 w-3.5" />
                    Updated {formatRelativeTime(note.updatedAt)}
                  </span>

                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {canReorder && (
                      <span
                        aria-hidden="true"
                        title="Drag to reorder"
                        className="flex h-8 w-7 cursor-grab items-center justify-center rounded-md text-neutral-300 active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(note);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      aria-label="Edit note"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(note.id);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
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
