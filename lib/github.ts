import { PullRequest, Comment, FullUser } from "@/types/github";
import { Octokit } from "octokit";

const octokit = new Octokit({
  auth: process.env.GITHUB_ACCESS_TOKEN,
  request: {
    fetch: window.fetch,
  },
});

export async function getNotifications(opts: {
  before?: string;
  since?: string;
}) {
  const result = await octokit.paginate("GET /notifications", {
    since: opts.since,
    before: opts.before,
    all: true,
  });
  console.debug("fetch notifications", result);
  return {
    result,
    before: opts.before,
    since: opts.since,
  };
}

export async function getNotificationThread(id: number) {
  const result = await octokit.request(
    `GET /notifications/threads/{thread_id}`,
    {
      thread_id: id,
    }
  );
  console.debug("fetch notification thread", result);
  return result.data;
}

export async function getLatestComment(url: string) {
  const result = await octokit.request(`GET ${url}`);
  console.debug("fetch latest comment", result);
  return result.data;
}

export async function getPullRequest(url: string): Promise<PullRequest> {
  const result = await octokit.request(`GET ${url}`);
  console.debug("fetch pull request", result);
  return result.data;
}

export async function getIssue(url: string): Promise<PullRequest> {
  const result = await octokit.request(`GET ${url}`);
  console.debug("fetch issue", result);
  return result.data;
}

export async function getIssueComments(url: string): Promise<Comment[]> {
  const result = await octokit.paginate(`GET ${url}`);
  console.debug("fetch issue comments", result);
  return result as Comment[];
}

export async function getUser(url: string): Promise<FullUser> {
  const result = await octokit.request(`GET ${url}`);
  console.debug("fetch user", result);
  return result.data;
}
