import { supabase } from '@/lib/supabase';

const VOTER_KEY = 'pulsedesk-voter-key';

export function getVoterKey(): string {
  try {
    const existing = localStorage.getItem(VOTER_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const fresh = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(VOTER_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing can block storage; fall back to a per-session key.
    const sessionKey = `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 32);
    return sessionKey.replace(/[^A-Za-z0-9_-]/g, 'a');
  }
}

export interface RoadmapEntry {
  id: string;
  name: string;
  message: string;
  category: string | null;
  roadmap_status: 'planned' | 'in_progress' | 'shipped';
  upvotes: number;
  created_at: string;
}

export interface RoadmapWorkspace {
  id: string;
  name: string;
  slug: string;
}

export async function getPublicRoadmap(slug: string): Promise<{ workspace: RoadmapWorkspace | null; entries: RoadmapEntry[] }> {
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (wsError) {
    console.error(wsError);
    throw new Error('This roadmap could not be loaded.');
  }
  if (!workspace) return { workspace: null, entries: [] };

  const { data: entries, error: entriesError } = await supabase.rpc('get_public_roadmap', { _slug: slug });
  if (entriesError) {
    console.error(entriesError);
    throw new Error('This roadmap could not be loaded.');
  }
  return { workspace: workspace as RoadmapWorkspace, entries: ((entries ?? []) as RoadmapEntry[]) };
}

export async function toggleUpvote(feedbackId: string): Promise<{ upvoted: boolean; upvotes: number }> {
  const { data, error } = await supabase.rpc('toggle_upvote', {
    _feedback_id: feedbackId,
    _voter_key: getVoterKey(),
  });
  if (error || !data || data.length === 0) {
    console.error(error);
    throw new Error('Your vote could not be counted. Please try again.');
  }
  return { upvoted: data[0].upvoted, upvotes: data[0].upvotes };
}

export async function fetchMyUpvotes(feedbackIds: string[]): Promise<Set<string>> {
  if (feedbackIds.length === 0) return new Set();
  const { data, error } = await supabase.rpc('get_public_roadmap_votes', {
    _feedback_ids: feedbackIds,
    _voter_key: getVoterKey(),
  });
  if (error) {
    console.error(error);
    return new Set();
  }
  return new Set(((data ?? []) as string[]));
}
