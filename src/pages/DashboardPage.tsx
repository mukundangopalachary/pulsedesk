import { CATEGORY_LABELS, SENTIMENT_LABELS } from '@/lib/format';
import type { FeedbackItem } from '@/lib/types';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10b981',
  neutral: '#a1a1aa',
  negative: '#f43f5e',
};

function buildDayBuckets(days: number): { label: string; date: Date }[] {
  const buckets: { label: string; date: Date }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    buckets.push({ label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), date });
  }
  return buckets;
}

function VolumeChart({ items }: { items: FeedbackItem[] }) {
  const buckets = buildDayBuckets(14);
  const counts = buckets.map((bucket) => ({
    label: bucket.label,
    count: items.filter((item) => {
      const created = new Date(item.created_at);
      created.setHours(0, 0, 0, 0);
      return created.getTime() === bucket.date.getTime();
    }).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Feedback volume</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">New items per day, last 14 days</p>
      <div className="mt-5 flex h-40 items-end gap-1.5">
        {counts.map((c) => (
          <div key={c.label} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="rounded-t-md bg-emerald-500/80 transition-colors group-hover:bg-emerald-500 dark:bg-emerald-600/80"
              style={{ height: `${(c.count / max) * 100}%`, minHeight: c.count > 0 ? '4px' : '2px', backgroundColor: c.count > 0 ? undefined : 'rgba(161,161,170,0.25)' }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
              {c.count} on {c.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
        <span>{counts[0]?.label}</span>
        <span>{counts[counts.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function SentimentChart({ items }: { items: FeedbackItem[] }) {
  const buckets = buildDayBuckets(14);
  const series = ['positive', 'neutral', 'negative'].map((sentiment) => ({
    sentiment,
    counts: buckets.map((bucket) =>
      items.filter((item) => {
        if (item.sentiment !== sentiment) return false;
        const created = new Date(item.created_at);
        created.setHours(0, 0, 0, 0);
        return created.getTime() === bucket.date.getTime();
      }).length,
    ),
  }));
  const max = Math.max(1, ...series.flatMap((s) => s.counts));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sentiment trend</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Daily counts by mood, last 14 days</p>
      <div className="mt-5 h-40">
        <svg viewBox="0 0 560 160" preserveAspectRatio="none" className="h-full w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <line key={fraction} x1="0" x2="560" y1={160 * fraction} y2={160 * fraction} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" strokeWidth="1" />
          ))}
          {series.map((s) => {
            const points = s.counts.map((count, i) => `${(i / (s.counts.length - 1)) * 560},${160 - (count / max) * 140}`).join(' ');
            return (
              <polyline
                key={s.sentiment}
                points={points}
                fill="none"
                stroke={SENTIMENT_COLORS[s.sentiment]}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.sentiment} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[s.sentiment] }} aria-hidden />
            {SENTIMENT_LABELS[s.sentiment as keyof typeof SENTIMENT_LABELS]}
          </span>
        ))}
      </div>
    </div>
  );
}

function CategoryChart({ items }: { items: FeedbackItem[] }) {
  const totals = (Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[])
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      count: items.filter((item) => item.category === category).length,
    }))
    .sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...totals.map((t) => t.count));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top categories</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">What customers write about most</p>
      <ul className="mt-5 space-y-3">
        {totals.map((t) => (
          <li key={t.category}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">{t.label}</span>
              <span className="text-xs tabular-nums text-zinc-400">{t.count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500 dark:bg-emerald-600"
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard({ items }: { items: FeedbackItem[] }) {
  const total = items.length;
  const last7 = items.filter((item) => Date.now() - new Date(item.created_at).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const avgRating = total ? items.reduce((sum, item) => sum + item.rating, 0) / total : 0;
  const openRate = total ? items.filter((item) => item.status !== 'resolved').length / total : 0;

  const stats = [
    { label: 'Total feedback', value: String(total) },
    { label: 'Last 7 days', value: String(last7) },
    { label: 'Average rating', value: avgRating ? `${avgRating.toFixed(1)} / 5` : '—' },
    { label: 'Still open', value: total ? `${Math.round(openRate * 100)}%` : '—' },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-5 sm:p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">How customers feel about your product at a glance.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <VolumeChart items={items} />
          <SentimentChart items={items} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <CategoryChart items={items} />
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Reading the charts</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              <li><strong className="text-zinc-800 dark:text-zinc-200">Volume</strong> spikes mean something happened — a release, an outage, a pricing change.</li>
              <li><strong className="text-zinc-800 dark:text-zinc-200">Sentiment</strong> lines drifting down together with rising volume usually signal a problem worth investigating today.</li>
              <li><strong className="text-zinc-800 dark:text-zinc-200">Categories</strong> tell you where to invest; the tallest bar is what customers care about most.</li>
              <li>Charts update instantly as new feedback arrives in the inbox.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
