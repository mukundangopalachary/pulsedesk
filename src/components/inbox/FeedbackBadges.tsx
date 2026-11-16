import { Star } from 'lucide-react';
import { STATUS_META } from '@/lib/format';
import type { FeedbackStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} aria-hidden />
      {meta.label}
    </span>
  );
}

export function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden
          className={`${sizing} ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-700'}`}
        />
      ))}
    </span>
  );
}

export function TagPill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}
