import { useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { addComment, deleteComment, listComments } from '@/lib/feedback';
import { formatRelative } from '@/lib/format';
import type { FeedbackComment, Role, TeamMember } from '@/lib/types';
import { Button, ErrorMessage, Textarea } from '@/components/ui';

interface CommentsSectionProps {
  workspaceId: string;
  feedbackId: string;
  currentUserId: string;
  team: TeamMember[];
  role: Role;
}

export default function CommentsSection({ workspaceId, feedbackId, currentUserId, team, role }: CommentsSectionProps) {
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const canComment = role !== 'viewer';
  const canModerate = role === 'owner' || role === 'admin';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setComments([]);
    (async () => {
      try {
        const rows = await listComments(feedbackId);
        if (!cancelled) setComments(rows);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Comments could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feedbackId]);

  const nameFor = (userId: string) => team.find((m) => m.user_id === userId)?.name ?? 'Former teammate';

  const handlePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPostError(null);
    setPosting(true);
    try {
      const comment = await addComment(workspaceId, feedbackId, body);
      setComments((prev) => [...prev, comment]);
      setDraft('');
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Your comment could not be posted.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (comment: FeedbackComment) => {
    setPostError(null);
    try {
      await deleteComment(comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Could not delete this comment.');
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Internal comments</h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Only visible to your team</span>
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading comments...</p>}
        <ErrorMessage message={loadError} />
        {!loading && !loadError && comments.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No comments yet. Leave a note for your team.
          </p>
        )}
        {comments.map((comment) => {
          const own = comment.author_id === currentUserId;
          return (
            <div key={comment.id} className="group rounded-lg bg-zinc-100/70 px-4 py-3 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{own ? 'You' : nameFor(comment.author_id)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatRelative(comment.created_at)}</span>
                </div>
                {(own || canModerate) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment)}
                    aria-label="Delete comment"
                    className="rounded p-1 text-zinc-400 opacity-0 transition hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{comment.body}</p>
            </div>
          );
        })}
      </div>

      {canComment && (
        <form onSubmit={handlePost} className="mt-4 space-y-3">
          <Textarea
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note for your team..."
            className="resize-none"
          />
          <ErrorMessage message={postError} />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={posting} disabled={!draft.trim()}>
              Post comment
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
