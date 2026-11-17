import { supabase } from '@/lib/supabase';
import type { PublicWorkspace, Role, TeamMember, Workspace, WorkspaceInvite } from '@/lib/types';

export async function createWorkspace(name: string, slug: string): Promise<Workspace> {
  const { data, error } = await supabase.rpc('create_workspace', { _name: name, _slug: slug });
  if (error || !data) {
    console.error(error);
    if (error?.code === '23505') {
      throw new Error('That link is already taken. Try a different one.');
    }
    throw new Error('Your workspace could not be created. Please try again.');
  }
  return data as Workspace;
}

export async function getFirstWorkspaceSlug(): Promise<string | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('slug')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error('Your workspaces could not be loaded.');
  }
  return data?.slug ?? null;
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error('This workspace could not be loaded.');
  }
  return data as Workspace | null;
}

export async function getMyRole(workspaceId: string): Promise<Role | null> {
  const { data, error } = await supabase.rpc('workspace_role', { _ws: workspaceId });
  if (error) {
    console.error(error);
    throw new Error('Your access could not be checked.');
  }
  return (data as Role | null) ?? null;
}

export async function getPublicWorkspace(slug: string): Promise<PublicWorkspace | null> {
  const { data, error } = await supabase.rpc('get_public_workspace', { _slug: slug });
  if (error) {
    console.error(error);
    throw new Error('This feedback form could not be loaded.');
  }
  const rows = (data ?? []) as PublicWorkspace[];
  return rows[0] ?? null;
}

export async function listTeam(workspaceId: string): Promise<TeamMember[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);
  if (memberError) {
    console.error(memberError);
    throw new Error('Your team could not be loaded.');
  }

  const members = (memberRows ?? []) as { user_id: string; role: Role }[];
  if (members.length === 0) return [];

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', members.map((m) => m.user_id));
  if (profileError) {
    console.error(profileError);
    throw new Error('Your team could not be loaded.');
  }

  const profiles = new Map(
    ((profileRows ?? []) as { id: string; email: string; full_name: string }[]).map((p) => [p.id, p]),
  );

  return members.map((m) => {
    const profile = profiles.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role,
      name: profile?.full_name || profile?.email || 'Unknown member',
      email: profile?.email ?? '',
    };
  });
}

export async function listPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('id, email, role, created_at, expires_at')
    .eq('workspace_id', workspaceId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    throw new Error('Pending invitations could not be loaded.');
  }
  return (data ?? []) as WorkspaceInvite[];
}

export interface InviteResult {
  sent: boolean;
  link: string;
}

export async function inviteTeammate(workspaceId: string, email: string, role: Role): Promise<InviteResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ workspaceId, email: email.trim(), role, origin: window.location.origin }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    console.error(payload);
    throw new Error(
      typeof payload?.error === 'string' && payload.error
        ? payload.error
        : 'The invitation could not be sent. Please try again.',
    );
  }
  return { sent: Boolean(payload.sent), link: String(payload.link ?? '') };
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', { _token: token });
  if (error || !data) {
    console.error(error);
    throw new Error(
      error?.message && !error.message.startsWith('Failed to run')
        ? error.message
        : 'This invitation could not be accepted.',
    );
  }
  return data as string;
}

export async function changeMemberRole(workspaceId: string, memberId: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('change_member_role', { _ws: workspaceId, _member: memberId, _role: role });
  if (error) {
    console.error(error);
    throw new Error(
      error.message && !error.message.startsWith('Failed to run')
        ? error.message
        : 'The role could not be changed. Please try again.',
    );
  }
}

export async function removeMember(workspaceId: string, memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { _ws: workspaceId, _member: memberId });
  if (error) {
    console.error(error);
    throw new Error(
      error.message && !error.message.startsWith('Failed to run')
        ? error.message
        : 'That member could not be removed. Please try again.',
    );
  }
}

export async function cancelInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_invite', { _invite_id: inviteId });
  if (error) {
    console.error(error);
    throw new Error(
      error.message && !error.message.startsWith('Failed to run')
        ? error.message
        : 'The invitation could not be cancelled. Please try again.',
    );
  }
}
