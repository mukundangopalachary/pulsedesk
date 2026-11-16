import type { FeedbackCategory, FeedbackSentiment, FeedbackStatus } from '@/lib/types';

export const STATUS_META: Record<FeedbackStatus, { label: string; className: string; dotClassName: string }> = {
  new: {
    label: 'New',
    className: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/20',
    dotClassName: 'bg-sky-500',
  },
  in_progress: {
    label: 'In progress',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20',
    dotClassName: 'bg-amber-500',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20',
    dotClassName: 'bg-emerald-500',
  },
};

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  feature_request: 'Feature request',
  pricing: 'Pricing',
  support: 'Support',
  other: 'Other',
};

export const SENTIMENT_LABELS: Record<FeedbackSentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

export function formatRelative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
