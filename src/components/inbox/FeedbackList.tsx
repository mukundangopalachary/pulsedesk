import { CATEGORY_LABELS, formatRelative } from '@/lib/format';
import type { FeedbackItem, FeedbackStatus } from '@/lib/types';
import { RatingStars, StatusBadge, TagPill } from '@/components/inbox/FeedbackBadges';

interface FeedbackListProps {
  items: FeedbackItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: FeedbackStatus | 'all';
  onFilterChange: (filter: FeedbackStatus | 'all') => void;
  counts: Record<FeedbackStatus | 'all', number>;
}

const FILTERS: { value: FeedbackStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

export default function FeedbackList({ items, selectedId, onSelect, filter, onFilterChange, counts }: FeedbackListProps) {
  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              }`}
            >
              {option.label}
              <span className={active ? 'opacity-70' : 'text-zinc-400 dark:text-zinc-500'}>{counts[option.value]}</span>
            </button>
          );
        })}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <li className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {items.length === 0
              ? 'No feedback yet. Share your feedback link to start collecting responses.'
              : 'Nothing in this view.'}
          </li>
        )}
        {visible.map((item) => {
          const active = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full border-b border-zinc-100 px-4 py-3.5 text-left transition-colors dark:border-zinc-800/70 ${
                  active ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{formatRelative(item.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-snug text-zinc-600 dark:text-zinc-400">{item.message}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <RatingStars rating={item.rating} />
                  {item.category && <TagPill>{CATEGORY_LABELS[item.category]}</TagPill>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
