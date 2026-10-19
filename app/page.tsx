'use client';

import * as React from 'react';
import {
  NotebookPen,
  Search,
  Plus,
  Pencil,
  Trash2,
  Clock,
  FileText,
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
import { cn } from '@/lib/utils';

type Status = 'Todo' | 'In-Progress' | 'On-Hold' | 'Done';

type Note = {
  id: string;
  title: string;
  status: Status;
  content: string;
  updatedAt: number;
};

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

const INITIAL_NOTES: Note[] = [
  {
    id: '1',
    title: 'Q4 Product Roadmap',
    status: 'In-Progress',
    content:
      'Outline the key initiatives for Q4 including the new analytics dashboard, billing revamp, and mobile app beta. Coordinate with design on wireframes by end of week and schedule a review with stakeholders.',
    updatedAt: Date.now() - 1000 * 60 * 35,
  },
  {
    id: '2',
    title: 'Onboarding Flow Redesign',
    status: 'Todo',
    content:
      'Audit the existing signup experience, identify drop-off points, and propose a three-step onboarding with progress indicators. Pull metrics from Mixpanel before Thursday.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: '3',
    title: 'Customer Feedback Synthesis',
    status: 'Done',
    content:
      'Compiled 240 responses from the September NPS survey into five themes. Top request: bulk export. Full report shared in the #product Slack channel.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: '4',
    title: 'API Rate Limiting Plan',
    status: 'On-Hold',
    content:
      'Drafting a tiered rate-limit strategy for v2 of the public API. Waiting on the infrastructure team to confirm Redis availability before finalizing the token bucket approach.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 50,
  },
  {
    id: '5',
    title: 'Marketing Site Copy Refresh',
    status: 'In-Progress',
    content:
      'Rewriting the hero, features, and pricing sections to match the new brand voice. Hero draft is in review with Sarah; pricing section still needs the FAQ block.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: '6',
    title: 'Hire a Senior Designer',
    status: 'Todo',
    content:
      'Update the job description, post to LinkedIn and Read.cv, and build a shortlist of portfolios. Aim to have first interviews scheduled within two weeks.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 8,
  },
  {
    id: '7',
    title: 'Migration to PostgreSQL 16',
    status: 'On-Hold',
    content:
      'Tested the extension compatibility in staging. Paused pending the seasonal traffic slowdown in November to avoid any risk during peak hours.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 72,
  },
  {
    id: '8',
    title: 'Weekly Team Retro Notes',
    status: 'Done',
    content:
      'Action items: ship the search fix, document the deploy process, and schedule a pairing session on testing. Next retro scheduled for Friday at 3pm.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 30,
  },
];

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

export default function Home() {
  const [notes, setNotes] = React.useState<Note[]>(INITIAL_NOTES);
  const [activeFilter, setActiveFilter] = React.useState<'All' | Status>('All');
  const [search, setSearch] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [status, setStatus] = React.useState<Status>('Todo');
  const [content, setContent] = React.useState('');

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setStatus('Todo');
    setContent('');
    setModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setStatus(note.status);
    setContent(note.content);
    setModalOpen(true);
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    if (editingId) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingId
            ? { ...n, title: trimmedTitle, status, content: content.trim(), updatedAt: Date.now() }
            : n
        )
      );
    } else {
      const newNote: Note = {
        id: `${Date.now()}`,
        title: trimmedTitle,
        status,
        content: content.trim(),
        updatedAt: Date.now(),
      };
      setNotes((prev) => [newNote, ...prev]);
    }

    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
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
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
                NoteLatte
              </h1>
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

        {/* Notes grid */}
        {filteredNotes.length > 0 ? (
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
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
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
              disabled={!title.trim()}
              className="bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {editingId ? 'Save changes' : 'Create note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
