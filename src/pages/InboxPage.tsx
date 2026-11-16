import { useEffect, useMemo, useState } from 'react';
import { Inbox, Link2, MousePointerClick } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { deleteFeedback, listFeedback, updateFeedback, type FeedbackPatch } from '@/lib/feedback';
import { getMyRole, getWorkspaceBySlug, listTeam } from '@/lib/workspace';
import { navigate } from '@/lib/router';
import type { FeedbackItem, FeedbackStatus, Role, TeamMember, Workspace } from '@/lib/types';
import FeedbackList from '@/components/inbox/FeedbackList';
import FeedbackDetail from '@/components/inbox/FeedbackDetail';
import { Button, ErrorMessage, Logo, Spinner, ThemeToggle } from '@/components/ui';

type StatusFilter = FeedbackStatus | 'all';

interface InboxPageProps {
  slug: string;
}

const LOAD_ERROR = 'This workspace could not be loaded. Please try again.';

export default function InboxPage({ slug }: InboxPageProps) {
  const { user, signOut } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    setSelectedId(null);
    (async () => {
      try {
        const found = await getWorkspaceBySlug(slug);
        if (!found) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const [myRole, members, feedbackItems] = await Promise.all([
          getMyRole(found.id),
          listTeam(found.id),
          listFeedback(found.id),
        ]);
        if (cancelled) return;
        if (!myRole) {
          setNotFound(true);
          return;
        }
        setWorkspace(found);
        setRole(myRole);
        setTeam(members);
        setItems(feedbackItems);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : LOAD_ERROR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const counts = useMemo<Record<StatusFilter, number>>(
    () => ({
      all: items.length,
      new: items.filter((i) => i.status === 'new').length,
      in_progress: items.filter((i) => i.status === 'in_progress').length,
      resolved: items.filter((i) => i.status === 'resolved').length,
    }),
    [items],
  );

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const handleUpdate = async (patch: FeedbackPatch) => {
    if (!selected) return;
    const updated = await updateFeedback(selected.id, patch);
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteFeedback(selected.id);
    setItems((prev) => prev.filter((item) => item.id !== selected.id));
    setSelectedId(null);
  };

  const copyFormLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Spinner />;

  if (notFound || !workspace || !role || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">We couldn't find that workspace</h1>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          It may have been removed, or you may not have access to it.
        </p>
        <Button variant="secondary" onClick={() => navigate('/app')}>
          Go to my workspace
        </Button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <ErrorMessage message={loadError} />
          <Button className="w-full" onClick={() => navigate(`/app/${slug}`)}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex min-w-0 items-center gap-3">
          <Logo compact />
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>/</span>
          <span className="truncate text-sm font-medium">{workspace.name}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="secondary" size="sm" onClick={copyFormLink} className="hidden sm:inline-flex">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {copied ? 'Link copied' : 'Copy feedback link'}
          </Button>
          <a
            href={`/f/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 md:inline-block dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Preview form
          </a>
          <ThemeToggle />
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`min-h-0 w-full flex-col border-r border-zinc-200 bg-white lg:flex lg:w-[380px] lg:shrink-0 dark:border-zinc-800 dark:bg-zinc-950 ${
            selected ? 'hidden' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h1 className="flex items-center gap-2 text-base font-semibold">
              <Inbox className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Feedback inbox
            </h1>
          </div>
          <div className="min-h-0 flex-1">
            <FeedbackList
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              filter={filter}
              onFilterChange={setFilter}
              counts={counts}
            />
          </div>
        </aside>

        <main className={`min-h-0 min-w-0 flex-1 bg-zinc-50 dark:bg-zinc-950 ${selected ? 'flex' : 'hidden lg:flex'}`}>
          {selected ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
              <FeedbackDetail
                key={selected.id}
                workspaceId={workspace.id}
                item={selected}
                team={team}
                role={role}
                currentUserId={user.id}
                onBack={() => setSelectedId(null)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-zinc-800">
                <MousePointerClick className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Select a piece of feedback to read it and reply to your team.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
