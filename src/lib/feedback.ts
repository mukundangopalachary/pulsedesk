import { supabase } from '@/lib/supabase';
import { callPublicAction } from '@/lib/publicActions';
import type { FeedbackCategory, FeedbackComment, FeedbackItem, FeedbackSentiment, FeedbackStatus, RoadmapStatus } from '@/lib/types';

export interface FeedbackInput {
  workspaceId: string;
  name: string;
  email: string;
  rating: number;
  message: string;
  category?: FeedbackCategory | null;
  sentiment?: FeedbackSentiment | null;
  screenshotPath?: string | null;
  captchaToken?: string | null;
}

export interface FeedbackPatch {
  status?: FeedbackStatus;
  roadmap_status?: RoadmapStatus | null;
  assignee_id?: string | null;
  tags?: string[];
}

const SAVE_ERROR = 'Could not save your changes. Please try again.';

export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const { id } = await callPublicAction<{ id: string }>(
    {
      action: 'submit_feedback',
      workspaceId: input.workspaceId,
      name: input.name,
      email: input.email,
      rating: input.rating,
      message: input.message,
      category: input.category ?? null,
      sentiment: input.sentiment ?? null,
      screenshotPath: input.screenshotPath ?? null,
      captchaToken: input.captchaToken ?? null,
    },
    'Your feedback could not be sent. Please try again.',
  );
  notifySlack(input.workspaceId, id);
}

function notifySlack(workspaceId: string, feedbackId: string): void {
  void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-slack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ record: { id: feedbackId, workspace_id: workspaceId } }),
  }).catch((err) => console.error(err));
}

export async function uploadScreenshot(workspaceId: string, file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Screenshots must be a JPG, PNG or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('That image is larger than 5 MB. Try a smaller one.');
  }
  const { path, token } = await callPublicAction<{ path: string; token: string }>(
    { action: 'upload_url', workspaceId, contentType: file.type },
    'Your screenshot could not be uploaded. You can still send your feedback without it.',
  );
  const { error } = await supabase.storage
    .from('feedback-screenshots')
    .uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) {
    console.error(error);
    throw new Error('Your screenshot could not be uploaded. You can still send your feedback without it.');
  }
  return path;
}

export async function getScreenshotUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('feedback-screenshots')
    .createSignedUrl(path, 300);
  if (error || !data) {
    console.error(error);
    return null;
  }
  return data.signedUrl;
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
