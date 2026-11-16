import { supabase } from '@/lib/supabase';
import type { PublicWorkspace, Role, TeamMember, Workspace } from '@/lib/types';

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
