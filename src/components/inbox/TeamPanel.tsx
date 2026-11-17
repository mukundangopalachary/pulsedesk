import { useState, type FormEvent } from 'react';
import { Check, Link2, Mail, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import {
  cancelInvite,
  changeMemberRole,
  inviteTeammate,
  listPendingInvites,
  removeMember,
} from '@/lib/workspace';
import { formatRelative } from '@/lib/format';
import type { Role, TeamMember, Workspace, WorkspaceInvite } from '@/lib/types';
import { Button, ErrorMessage, Field, Input, Spinner } from '@/components/ui';

const ASSIGNABLE_ROLES: { value: 'admin' | 'member' | 'viewer'; label: string; blurb: string }[] = [
  { value: 'admin', label: 'Admin', blurb: 'Can manage feedback and the team' },
  { value: 'member', label: 'Member', blurb: 'Can triage and comment on feedback' },
  { value: 'viewer', label: 'Viewer', blurb: 'Can read feedback only' },
];

const ROLE_BLURBS: Record<Role, string> = {
  owner: 'Full control, including this team panel',
  admin: 'Can manage feedback and the team',
  member: 'Can triage and comment on feedback',
  viewer: 'Can read feedback only',
};

interface TeamPanelProps {
  workspace: Workspace;
  team: TeamMember[];
  currentUserId: string;
  role: Role;
  onClose: () => void;
  onTeamChanged: (team: TeamMember[]) => void;
}

export default function TeamPanel({ workspace, team, currentUserId, role, onClose, onTeamChanged }: TeamPanelProps) {
  const canManage = role === 'owner' || role === 'admin';
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<WorkspaceInvite[] | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const loadPending = async () => {
    if (!canManage) return;
    setPendingError(null);
    try {
      setPending(await listPendingInvites(workspace.id));
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : 'Invitations could not be loaded.');
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Team
          </h1>
          <button type="button" onClick={onClose} aria-label="Close team panel" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800/70">
          {team.map((member) => (
            <li key={member.user_id} className="px-4 py-3">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{member.name}</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{ROLE_BLURBS[member.role]}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError(null);
    setInviteNotice(null);
    setInviting(true);
    try {
      const result = await inviteTeammate(workspace.id, inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteNotice(
        result.sent
          ? `Invitation emailed to ${result.link ? '' : ''}your teammate. They can also use this link: ${result.link}`
          : `Email delivery is not set up yet, so share this join link directly: ${result.link}`,
      );
      await loadPending();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'The invitation could not be sent.');
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = async (invite: WorkspaceInvite) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.id}`);
      setCopiedId(invite.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (member: TeamMember, nextRole: Role) => {
    if (nextRole === member.role) return;
    setRowBusy(member.user_id);
    try {
      await changeMemberRole(workspace.id, member.user_id, nextRole);
      onTeamChanged(team.map((m) => (m.user_id === member.user_id ? { ...m, role: nextRole } : m)));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'The role could not be changed.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    setRowBusy(member.user_id);
    try {
      await removeMember(workspace.id, member.user_id);
      onTeamChanged(team.filter((m) => m.user_id !== member.user_id));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'That member could not be removed.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleCancelInvite = async (invite: WorkspaceInvite) => {
    setRowBusy(invite.id);
    try {
      await cancelInvite(invite.id);
      setPending((prev) => (prev ? prev.filter((i) => i.id !== invite.id) : prev));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'The invitation could not be cancelled.');
    } finally {
      setRowBusy(null);
    }
  };

  if (pending === null && !pendingError) {
    void loadPending();
  }

  const roleSelect = (member: TeamMember) => (
    <select
      value={member.role}
      disabled={rowBusy === member.user_id}
      onChange={(e) => void handleRoleChange(member, e.target.value as Role)}
      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {member.role === 'owner' && <option value="owner">Owner</option>}
      {ASSIGNABLE_ROLES.map((r) => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Team
        </h1>
        <button type="button" onClick={onClose} aria-label="Close team panel" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-4 py-5">
        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            Invite a teammate
          </h2>
          <form onSubmit={handleInvite} className="mt-3 space-y-3">
            <Field label="Email">
              <Input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </Field>
            <Field label="Role">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label} — {r.blurb}</option>
                ))}
              </select>
            </Field>
            <ErrorMessage message={inviteError} />
            {inviteNotice && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed break-all text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Invitation ready
                </span>
                {inviteNotice}
              </div>
            )}
            <Button type="submit" size="sm" loading={inviting}>
              Send invitation
            </Button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Members ({team.length})</h2>
          <ul className="mt-3 space-y-2">
            {team.map((member) => (
              <li
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {member.name}
                    {member.user_id === currentUserId && <span className="ml-1.5 text-xs text-zinc-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{ROLE_BLURBS[member.role]}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {roleSelect(member)}
                  {member.role !== 'owner' && member.user_id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(member)}
                      disabled={rowBusy === member.user_id}
                      aria-label={`Remove ${member.name}`}
                      className="rounded p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Pending invitations
          </h2>
          {pendingError && <ErrorMessage message={pendingError} />}
          {pending === null && !pendingError && <Spinner />}
          {pending && pending.length === 0 && (
            <p className="mt-3 rounded-lg border border-dashed border-zinc-300 px-4 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No pending invitations.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {(pending ?? []).map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{invite.email}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {invite.role} · invited {formatRelative(invite.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void copyInviteLink(invite)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    {copiedId === invite.id ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
                    {copiedId === invite.id ? 'Copied' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancelInvite(invite)}
                    disabled={rowBusy === invite.id}
                    aria-label={`Cancel invite for ${invite.email}`}
                    className="rounded p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex items-start gap-2 rounded-lg bg-zinc-100/70 px-3 py-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Invitations expire after 7 days. Teammates must accept the link while signed in with the invited email address.
        </section>
      </div>
    </div>
  );
}
