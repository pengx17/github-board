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
  console.log("fetching notifications", result);
  return {
    result,
    before: opts.before,
    since: opts.since,
  };
}

export async function getNotificationThread(id: number) {
  const result = await octokit.request(`GET /notifications/threads/{thread_id}`, {
    thread_id: id,
  });
  console.log("fetching notification thread", result);
  return result.data;
}

export async function getLatestComment(url: string) {
  const result = await octokit.request(`GET ${url}`);
  console.log("fetching latest comment", result);
  return result.data;
}
