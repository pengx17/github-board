export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: User;
}

export interface User {
  login: string;
  id: number;
  avatar_url: string;
  url: string;
}

export interface FullUser extends User {
  name: string;
  type: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  url: string;
  description: string;
}

export interface Issue {
  id: number;
  title: string;
  comments_url: string;
  user: User;
  assignees: User[];
  state: string;
  state_reason: string;
  labels: Label[];
  body: string;
  url: string;
  number: number;
  created_at: string;
  updated_at: string;
}

export interface PullRequest extends Issue {
  requested_reviewers: User[];
}

export interface NotificationSubject {
  title: string;
  url: string;
  latest_comment_url: string;
  type: string;
}

export interface Notification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at: string | null;
  subject: NotificationSubject;
  repository: Repository;
}

export interface Comment {
  id: number;
  user: User;
  body: string;
  created_at: string;
  updated_at: string;
  issue_url: string;
}
