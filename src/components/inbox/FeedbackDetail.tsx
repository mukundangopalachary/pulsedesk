import { useState, type KeyboardEvent } from 'react';
import { ArrowLeft, Mail, Trash2, X } from 'lucide-react';
import { CATEGORY_LABELS, formatFullDate, SENTIMENT_LABELS, STATUS_META } from '@/lib/format';
import type { FeedbackItem, FeedbackStatus, Role, TeamMember } from '@/lib/types';
import type { FeedbackPatch } from '@/lib/feedback';
import { RatingStars, StatusBadge, TagPill } from '@/components/inbox/FeedbackBadges';
import CommentsSection from '@/components/inbox/CommentsSection';
import { Button, ErrorMessage, Field } from '@/components/ui';

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 24;
const STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'resolved'];

interface FeedbackDetailProps {
  workspaceId: string;
  item: FeedbackItem;
  team: TeamMember[];
  role: Role;
  currentUserId: string;
  onBack: () => void;
  onUpdate: (patch: FeedbackPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function FeedbackDetail({
  workspaceId,
  item,
  team,
  role,
  currentUserId,
  onBack,
  onUpdate,
  onDelete,
}: FeedbackDetailProps) {
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = role !== 'viewer';
  const canDelete = role === 'owner' || role === 'admin';

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setSaving(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = (status: FeedbackStatus) => {
    if (status === item.status) return;
    void run(() => onUpdate({ status }));
  };

  const changeAssignee = (value: string) => {
    void run(() => onUpdate({ assignee_id: value || null }));
  };

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    setTagDraft('');
    if (!tag || item.tags.includes(tag) || item.tags.length >= MAX_TAGS) return;
    void run(() => onUpdate({ tags: [...item.tags, tag] }));
  };

  const removeTag = (tag: string) => {
    void run(() => onUpdate({ tags: item.tags.filter((t) => t !== tag) }));
  };

  const handleTagKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this feedback.');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 lg:hidden dark:border-zinc-800">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to inbox
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-5 py-6 sm:px-8">
          <section>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight">{item.name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 hover:text-emerald-700 dark:hover:text-emerald-400">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    {item.email}
                  </a>
                  <span aria-hidden>·</span>
                  <span>{formatFullDate(item.created_at)}</span>
                </div>
              </div>
              <RatingStars rating={item.rating} size="md" />
            </div>

            <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {item.message}
            </div>

            {(item.category || item.sentiment) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.category && <TagPill>{CATEGORY_LABELS[item.category]}</TagPill>}
                {item.sentiment && <TagPill>{SENTIMENT_LABELS[item.sentiment]}</TagPill>}
              </div>
            )}
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div>
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</span>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
                {STATUSES.map((status) => {
                  const active = item.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={!canEdit || saving}
                      onClick={() => changeStatus(status)}
                      aria-pressed={active}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-900 disabled:hover:text-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-100'
                      }`}
                    >
                      {active && <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${STATUS_META[status].dotClassName}`} aria-hidden />}
                      {STATUS_META[status].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Assignee">
              <select
                disabled={!canEdit || saving}
                value={item.assignee_id ?? ''}
                onChange={(e) => changeAssignee(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Unassigned</option>
                {team.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name}
                    {member.user_id === currentUserId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          <section>
            <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tags</span>
            <div className="flex flex-wrap items-center gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 py-0.5 pl-2 pr-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20"
                >
                  {tag}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </span>
              ))}
              {canEdit && item.tags.length < MAX_TAGS && (
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={addTag}
                  maxLength={MAX_TAG_LENGTH}
                  placeholder="Add tag and press Enter"
                  className="min-w-[10rem] flex-1 rounded-md border border-dashed border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              )}
            </div>
          </section>

          <ErrorMessage message={error} />

          <CommentsSection workspaceId={workspaceId} feedbackId={item.id} currentUserId={currentUserId} team={team} role={role} />

          {canDelete && (
            <section className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
              {confirmingDelete ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Delete this feedback permanently?</span>
                  <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
                    Yes, delete
                  </Button>
                  <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete feedback
                </Button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
