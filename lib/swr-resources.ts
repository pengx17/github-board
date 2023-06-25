import { openDB } from "idb";
import { Issue, Notification, Comment, FullUser } from "@/types/github";
import { Observable, shareReplay } from "rxjs";
import { formatISO, subDays } from "date-fns";
import {
  transact,
  issueToDatoms,
  commentToDatoms,
  userToDatoms,
  notificationToDatoms,
} from "./datascript";
import {
  getNotifications,
  getIssue,
  getIssueComments,
  getUser,
} from "./github";

export function getSWRStream$<T, F extends () => Promise<T>>(
  fetcher: F,
  getStored: () => Promise<T>,
  opts?: {
    refreshInterval?: number;
  }
) {
  const ob = new Observable<T>((subscriber) => {
    (async () => {
      const stored = await getStored();
      subscriber.next(stored);
      const result = await fetcher();
      subscriber.next(result);
    })();

    let timer = 0;
    if (opts?.refreshInterval) {
      timer = setInterval(async () => {
        const result = await fetcher();
        subscriber.next(result);
      }, opts.refreshInterval);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  });

  return ob.pipe(
    shareReplay({
      refCount: true,
      bufferSize: 1,
    })
  );
}

export async function mergeAndStoreNotifications(
  notifications: Notification[]
) {
  const db = await openDB("notifications", 1, {
    upgrade(db) {
      db.createObjectStore("notifications");
    },
  });
  const tx = db.transaction("notifications", "readwrite");
  const existingNotifications: Notification[] =
    (await tx.store.get("notifications")) ?? [];
  // merge notifications based on id
  // if the id is the same, use the new notification
  const allNotifications = [
    ...existingNotifications.filter(
      (existingNotification) =>
        !notifications.some(
          (newNotification) => newNotification.id === existingNotification.id
        )
    ),
    ...notifications,
  ];
  await tx.store.put(allNotifications, "notifications");
  await tx.done;
  db.close();

  const datoms = allNotifications.flatMap((notification) => {
    return notificationToDatoms(notification);
  });

  transact(datoms, "updating notifications");
  return allNotifications.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

let lastFetchBefore: string | null = null;

function getCurrentNotificationParam(lastFetchBefore: string | null) {
  const now = new Date();
  const before = now; // new before
  const since = lastFetchBefore ?? formatISO(subDays(now, 30)); // new since
  return {
    before: formatISO(before),
    since,
  };
}

export const notifications$ = getSWRStream$(
  async () => {
    const { before, since } = getCurrentNotificationParam(lastFetchBefore);
    const response = await getNotifications({ before, since });
    if (response && response.before) {
      lastFetchBefore = response.before;
    }
    return mergeAndStoreNotifications(response.result);
  },
  async () => {
    return mergeAndStoreNotifications([]);
  },
  {
    refreshInterval: 1000 * 30,
  }
);

async function mergeAndStoreIssue(repo: string, id: number, issue?: Issue) {
  const db = await openDB("issues", 1, {
    upgrade(db) {
      db.createObjectStore("issues");
    },
  });
  const tx = db.transaction("issues", "readwrite");
  const existingIssue = await tx.store.get(`${repo}#${id}`);
  const mergedIssue: Issue = {
    ...existingIssue,
    ...issue,
  };
  await tx.store.put(mergedIssue, `${repo}#${id}`);
  await tx.done;
  db.close();
  if (mergedIssue.url) {
    const datoms = issueToDatoms(mergedIssue);
    transact(datoms, "updating issue");
  }
  return mergedIssue;
}

const issue$Cache = new Map<string, Observable<Issue>>();

export const getIssue$ = (repo: string, id: number) => {
  const key = `${repo}#${id}`;
  let issue$ = issue$Cache.get(key);
  if (!issue$) {
    issue$ = getSWRStream$(
      async () => {
        const url = `https://api.github.com/repos/${repo}/issues/${id}`;
        const issue = await getIssue(url);
        return mergeAndStoreIssue(repo, id, issue);
      },
      async () => {
        return mergeAndStoreIssue(repo, id);
      },
      {
        refreshInterval: 1000 * 60 * 60,
      }
    );
    // mem leak!
    issue$Cache.set(key, issue$);
  }
  return issue$;
};

async function mergeAndStoreComments(
  repo: string,
  id: number,
  comments: Comment[]
) {
  const db = await openDB("comments", 1, {
    upgrade(db) {
      db.createObjectStore("comments");
    },
  });
  const tx = db.transaction("comments", "readwrite");
  const existingComments: Comment[] =
    (await tx.store.get(`${repo}#${id}`)) || [];
  const mergedComments: Comment[] = [
    // filter out existing comments
    ...existingComments.filter(
      (existingComment) =>
        !comments.some((newComment) => newComment.id === existingComment.id)
    ),
    ...comments,
  ];
  await tx.store.put(mergedComments, `${repo}#${id}`);
  await tx.done;
  db.close();
  const datoms = mergedComments.flatMap((comment) => {
    return commentToDatoms(comment);
  });
  transact(datoms, "updating comments");
  mergedComments.sort((a, b) => {
    return a.updated_at.localeCompare(b.updated_at);
  });
  return mergedComments;
}

const comments$Cache = new Map<string, Observable<Comment[]>>();

export const getComments$ = (repo: string, id: number) => {
  const key = `${repo}#${id}`;
  let comments$ = comments$Cache.get(key);
  if (!comments$) {
    comments$ = getSWRStream$(
      async () => {
        const url = `https://api.github.com/repos/${repo}/issues/${id}/comments`;
        const comments = await getIssueComments(url);
        return mergeAndStoreComments(repo, id, comments);
      },
      async () => {
        return mergeAndStoreComments(repo, id, []);
      },
      {
        refreshInterval: 1000 * 60 * 60,
      }
    );
    // mem leak!
    comments$Cache.set(key, comments$);
  }
  return comments$;
};

async function mergeAndStoreUser(login: string, user?: FullUser) {
  const db = await openDB("users", 1, {
    upgrade(db) {
      db.createObjectStore("users");
    },
  });
  const tx = db.transaction("users", "readwrite");
  const existingUser = await tx.store.get(login);
  const mergedUser: FullUser = {
    ...existingUser,
    ...user,
  };
  await tx.store.put(mergedUser, login);
  await tx.done;
  db.close();
  const datoms = userToDatoms(mergedUser);
  transact(datoms, "updating user");
  return mergedUser;
}

const user$Cache = new Map<string, Observable<FullUser>>();

export const getUser$ = (login: string) => {
  let user$ = user$Cache.get(login);
  if (!user$) {
    user$ = getSWRStream$(
      async () => {
        const url = `https://api.github.com/users/${login}`;
        const user = await getUser(url);
        return mergeAndStoreUser(login, user);
      },
      async () => {
        return mergeAndStoreUser(login);
      },
      {
        refreshInterval: 1000 * 60 * 60,
      }
    );
    // mem leak!
    user$Cache.set(login, user$);
  }
  return user$;
};
