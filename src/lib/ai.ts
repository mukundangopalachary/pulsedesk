import { supabase } from '@/lib/supabase';
import type { FeedbackCategory, FeedbackSentiment, FeedbackItem } from '@/lib/types';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai`;

export interface AiClassification {
  category: FeedbackCategory;
  sentiment: FeedbackSentiment;
}

async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    console.error(payload);
    throw new Error(
      typeof payload?.error === 'string' && payload.error
        ? payload.error
        : 'The AI request failed. Please try again.',
    );
  }
  return payload as T;
}

export function classifyFeedback(message: string): Promise<AiClassification> {
  return callAi<AiClassification>({ action: 'classify', message });
}

export function summarizeFeedback(items: FeedbackItem[]): Promise<string> {
  return callAi<{ summary: string }>({
    action: 'summarize',
    items: items.map((item) => ({
      name: item.name,
      rating: item.rating,
      message: item.message,
      status: item.status,
      tags: item.tags,
    })),
  }).then((data) => data.summary);
}

export function draftReply(item: FeedbackItem): Promise<string> {
  return callAi<{ reply: string }>({
    action: 'draft_reply',
    customerName: item.name,
    rating: item.rating,
    message: item.message,
  }).then((data) => data.reply);
}
