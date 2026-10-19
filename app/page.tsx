'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { NotebookPen, ArrowRight, Check, Search, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/auth-context';

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen bg-neutral-50/60 text-neutral-900">
      {/* Top bar */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <NotebookPen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-neutral-900">NoteLatte</span>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/auth')}
          className="border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100"
        >
          Sign In
        </Button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Minimalist notes, brewed fresh
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl sm:leading-[1.1]">
            Your thoughts,
            <br className="hidden sm:block" />{' '}
            <span className="text-neutral-500">organized and calm.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            NoteLatte is a distraction-free workspace for capturing ideas, tracking progress, and
            keeping every note exactly where it belongs.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => router.push('/auth?mode=signup')}
              className="h-11 w-full bg-neutral-900 text-white hover:bg-neutral-800 sm:w-auto"
            >
              Get Started Free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/auth')}
              className="h-11 w-full border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 sm:w-auto"
            >
              Sign In
            </Button>
          </div>
          <p className="mt-4 text-xs text-neutral-400">No credit card required · Free forever</p>
        </div>
      </section>

      {/* Preview */}
      <section className="mx-auto mt-16 max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* Mock app chrome */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <NotebookPen className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-neutral-900">NoteLatte</span>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-48 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 text-xs text-neutral-400">
                <Search className="h-3.5 w-3.5" />
                Search notes...
              </div>
              <div className="flex h-8 items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 text-xs font-medium text-white">
                <Plus className="h-3.5 w-3.5" />
                New Note
              </div>
            </div>
          </div>

          {/* Mock filter chips */}
          <div className="flex flex-wrap gap-2 px-4 py-3 sm:px-6">
            {['All', 'Todo', 'In-Progress', 'On-Hold', 'Done'].map((label, i) => (
              <span
                key={label}
                className={
                  i === 0
                    ? 'inline-flex items-center gap-2 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                    : 'inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600'
                }
              >
                {label}
              </span>
            ))}
          </div>

          {/* Mock cards */}
          <div className="grid grid-cols-1 gap-4 px-4 pb-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {[
              {
                title: 'Q4 Product Roadmap',
                status: 'In-Progress',
                tone: 'bg-blue-50 text-blue-700',
                dot: 'bg-blue-500',
              },
              {
                title: 'Customer Feedback Synthesis',
                status: 'Done',
                tone: 'bg-emerald-50 text-emerald-700',
                dot: 'bg-emerald-500',
              },
              {
                title: 'API Rate Limiting Plan',
                status: 'On-Hold',
                tone: 'bg-amber-50 text-amber-700',
                dot: 'bg-amber-500',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">
                    {card.title}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${card.tone}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
                    {card.status}
                  </span>
                </div>
                <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-neutral-600">
                  A clean, focused space for your notes — capture, organize, and revisit anytime.
                </p>
                <div className="mt-4 flex items-center border-t border-neutral-100 pt-3 text-xs text-neutral-400">
                  Updated 2h ago
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature bullets */}
      <section className="mx-auto mt-20 max-w-[1000px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            {
              title: 'Capture in seconds',
              body: 'A single, distraction-free editor. Title, status, content — done.',
            },
            {
              title: 'Stay organized',
              body: 'Filter by Todo, In-Progress, On-Hold, and Done. Always know what is next.',
            },
            {
              title: 'Beautiful by default',
              body: 'A calm, Notion-style interface that gets out of the way of your thinking.',
            },
          ].map((feature) => (
            <div key={feature.title} className="flex flex-col">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <Check className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-24 max-w-[1000px] px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Ready to brew your first note?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-neutral-600">
            Join NoteLatte and start organizing your thoughts in a calm, focused workspace.
          </p>
          <Button
            onClick={() => router.push('/auth?mode=signup')}
            className="mt-6 h-11 bg-neutral-900 text-white hover:bg-neutral-800"
          >
            Get Started Free
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="mx-auto max-w-[1200px] px-4 py-10 text-center text-xs text-neutral-400 sm:px-6 lg:px-8">
        NoteLatte · A minimalist notes prototype
      </footer>
    </div>
  );
}
