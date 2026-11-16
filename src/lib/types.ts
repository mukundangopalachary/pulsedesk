export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export type FeedbackStatus = 'new' | 'in_progress' | 'resolved';

export type FeedbackCategory = 'bug' | 'feature_request' | 'pricing' | 'support' | 'other';

export type FeedbackSentiment = 'positive' | 'neutral' | 'negative';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

export interface PublicWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface TeamMember {
  user_id: string;
  role: Role;
  name: string;
  email: string;
}

export interface FeedbackItem {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  rating: number;
  message: string;
  status: FeedbackStatus;
  category: FeedbackCategory | null;
  sentiment: FeedbackSentiment | null;
  tags: string[];
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackComment {
  id: string;
  feedback_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
