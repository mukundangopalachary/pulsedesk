import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader, SearchX, ThumbsUp } from 'lucide-react';
import { CATEGORY_LABELS, formatRelative } from '@/lib/format';
import { fetchMyUpvotes, getPublicRoadmap, toggleUpvote, type RoadmapEntry } from '@/lib/roadmap';
import { ErrorMessage, Logo, Spinner, ThemeToggle } from '@/components/ui';

const STAGES = ['planned', 'in_progress', 'shipped'] as const;

const STAGE_META: Record<(typeof STAGES)[number], { label: string; icon: typeof Circle; className: string }> = {
  planned: { label: 'Planned', icon: Circle, className: 'text-sky-600 dark:text-sky-400' },
  in_progress: { label: 'In progress', icon: Loader, className: 'text-amber-600 dark:text-amber-400' },
  shipped: { label: 'Shipped', icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
};

interface RoadmapPageProps {
  slug: string;
}

export default function RoadmapPage({ slug }: RoadmapPageProps) {
  const [workspace, setWorkspace] = useState<{ name: string } | null>(null);
  const [entries, setEntries] = useState<RoadmapEntry[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { workspace: found, entries: list } = await getPublicRoadmap(slug);
        if (cancelled) return;
        setWorkspace(found);
        setEntries(list);
        const votes = await fetchMyUpvotes(list.map((entry) => entry.id));
        if (!cancelled) setMyVotes(votes);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'This roadmap could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const grouped = useMemo(() => {
    const map = new Map<string, RoadmapEntry[]>();
    for (const stage of STAGES) {
      map.set(stage, entries.filter((entry) => entry.roadmap_status === stage));
    }
    return map;
  }, [entries]);

  const handleVote = async (entry: RoadmapEntry) => {
    setVoteError(null);
    setVotingId(entry.id);
    const wasVoted = myVotes.has(entry.id);
    setMyVotes((prev) => {
      const next = new Set(prev);
      if (wasVoted) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
    setEntries((prev) =>
      prev.map((item) =>
        item.id === entry.id ? { ...item, upvotes: item.upvotes + (wasVoted ? -1 : 1) } : item,
      ),
    );
    try {
      const result = await toggleUpvote(entry.id);
      setEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? { ...item, upvotes: result.upvotes } : item)),
      );
    } catch (err) {
      setMyVotes((prev) => {
        const next = new Set(prev);
        if (wasVoted) next.delete(entry.id);
        else next.add(entry.id);
        return next;
      });
      setEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id ? { ...item, upvotes: item.upvotes + (wasVoted ? 1 : -1) } : item,
        ),
      );
      setVoteError(err instanceof Error ? err.message : 'Your vote could not be counted.');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 justify-center px-6 pb-20 pt-4">
        {loading && <Spinner />}

        {!loading && loadError && (
          <div className="w-full max-w-md pt-12">
            <ErrorMessage message={loadError} />
          </div>
        )}

        {!loading && !loadError && !workspace && (
          <div className="flex w-full max-w-md flex-col items-center pt-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-200/70 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <SearchX className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-6 text-xl font-semibold">This roadmap doesn't exist</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Check the link you were given and try again.</p>
          </div>
        )}

        {!loading && !loadError && workspace && (
          <div className="w-full max-w-5xl">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Public roadmap</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">What {workspace.name} is building</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Requests come straight from customer feedback. Click the arrow to add your vote — your vote is anonymous.
            </p>
            <ErrorMessage message={voteError} />

            {entries.length === 0 ? (
              <div className="mt-12 rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Nothing on the roadmap yet. The team promotes feedback here as they plan it.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {STAGES.map((stage) => {
                  const meta = STAGE_META[stage];
                  const StageIcon = meta.icon;
                  const stageEntries = grouped.get(stage) ?? [];
                  return (
                    <section key={stage} className="rounded-2xl bg-zinc-100/70 p-4 dark:bg-zinc-900/60">
                      <h2 className={`flex items-center gap-1.5 text-sm font-semibold ${meta.className}`}>
                        <StageIcon className="h-4 w-4" aria-hidden />
                        {meta.label}
                        <span className="ml-auto text-xs font-normal text-zinc-400">{stageEntries.length}</span>
                      </h2>
                      <ul className="mt-3 space-y-3">
                        {stageEntries.length === 0 && (
                          <li className="rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                            Nothing here yet
                          </li>
                        )}
                        {stageEntries.map((entry) => {
                          const voted = myVotes.has(entry.id);
                          return (
                            <li
                              key={entry.id}
                              className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                            >
                              <button
                                type="button"
                                onClick={() => void handleVote(entry)}
                                disabled={votingId === entry.id}
                                aria-pressed={voted}
                                aria-label={`${voted ? 'Remove your vote from' : 'Upvote'}: ${entry.message.slice(0, 60)}`}
                                className={`flex h-fit w-12 shrink-0 flex-col items-center gap-0.5 rounded-lg border py-1.5 transition-all duration-150 active:scale-95 ${
                                  voted
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'border-zinc-200 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:hover:text-emerald-400'
                                }`}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                                <span className="text-xs font-semibold tabular-nums">{entry.upvotes}</span>
                              </button>
                              <div className="min-w-0">
                                <p className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">{entry.message}</p>
                                <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                                  {entry.name} · {formatRelative(entry.created_at)}
                                  {entry.category && ` · ${CATEGORY_LABELS[entry.category as keyof typeof CATEGORY_LABELS] ?? entry.category}`}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
