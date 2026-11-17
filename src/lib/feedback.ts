import { supabase } from '@/lib/supabase';
import type { FeedbackComment, FeedbackItem, FeedbackStatus } from '@/lib/types';

export interface FeedbackInput {
  workspaceId: string;
  name: string;
  email: string;
  rating: number;
  message: string;
  category?: FeedbackCategory | null;
  sentiment?: FeedbackSentiment | null;
}

export interface FeedbackPatch {
  status?: FeedbackStatus;
  assignee_id?: string | null;
  tags?: string[];
}

const SAVE_ERROR = 'Could not save your changes. Please try again.';

export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const { error } = await supabase.from('feedback').insert({
    workspace_id: input.workspaceId,
    name: input.name,
    email: input.email,
    rating: input.rating,
    message: input.message,
    category: input.category ?? null,
    sentiment: input.sentiment ?? null,
  });
  if (error) {
    console.error(error);
    throw new Error('Your feedback could not be sent. Please try again.');
  }
}

export async function listFeedback(workspaceId: string): Promise<FeedbackItem[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    throw new Error('Feedback could not be loaded.');
  }
  return data as FeedbackItem[];
}

export async function updateFeedback(id: string, patch: FeedbackPatch): Promise<FeedbackItem> {
  const { data, error } = await supabase
    .from('feedback')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    console.error(error);
    throw new Error(SAVE_ERROR);
  }
  return data as FeedbackItem;
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from('feedback').delete().eq('id', id);
  if (error) {
    console.error(error);
    throw new Error('Could not delete this feedback. Please try again.');
  }
}

export async function listComments(feedbackId: string): Promise<FeedbackComment[]> {
  const { data, error } = await supabase
    .from('feedback_comments')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    throw new Error('Comments could not be loaded.');
  }
  return data as FeedbackComment[];
}

export async function addComment(workspaceId: string, feedbackId: string, body: string): Promise<FeedbackComment> {
  const { data, error } = await supabase
    .from('feedback_comments')
    .insert({ workspace_id: workspaceId, feedback_id: feedbackId, body })
    .select('*')
    .maybeSingle();
  if (error || !data) {
    console.error(error);
    throw new Error('Your comment could not be posted. Please try again.');
  }
  return data as FeedbackComment;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('feedback_comments').delete().eq('id', id);
  if (error) {
    console.error(error);
    throw new Error('Could not delete this comment. Please try again.');
  }
}
