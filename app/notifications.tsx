import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getIssue,
  getIssueComments,
  getNotifications,
  getUser,
} from "@/lib/github";
import { formatISO, formatDistance, subMonths, subDays } from "date-fns";

import { openDB } from "idb";

import { useAtomValue } from "jotai";
import { atomWithObservable } from "jotai/utils";

import {
  interval,
  of,
  timer,
  shareReplay,
  merge,
  map,
  defer,
  switchMap,
  debounceTime,
} from "rxjs";

import { Notification } from "@/types/github";
import {
  commentToDatoms,
  datoms$,
  issueToDatoms,
  query,
  transact,
  userToDatoms,
} from "@/lib/datascript";
import { useEffect } from "react";

let lastFetchBefore: string | null = null;

function getCurrentNotificationParam(lastFetchBefore: string | null) {
  const now = new Date();
  const before = now; // new before
  // const since = lastFetchBefore ?? formatISO(subMonths(now, 1)); // new since
  const since = lastFetchBefore ?? formatISO(subDays(now, 1)); // new since
  return {
    before: formatISO(before),
    since,
  };
}

async function mergeAndStoreNotifications(notifications: Notification[]) {
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
  return allNotifications;
}

const notifications$ = merge(
  of(0),
  defer(() => timer(100).pipe(map(() => 1))),
  interval(1000 * 30)
).pipe(
  switchMap((tick) => {
    if (tick === 0) {
      return of(null);
    }
    const { before, since } = getCurrentNotificationParam(lastFetchBefore);
    return getNotifications({ before, since });
  }),
  switchMap(async (response) => {
    const allNotifications = await mergeAndStoreNotifications(
      response?.result ?? []
    );
    if (response && response.before) {
      lastFetchBefore = response.before;
    }
    return allNotifications.sort((a, b) => {
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }),
  shareReplay(1)
);

const users$ = merge(of(0), datoms$.pipe(debounceTime(500))).pipe(
  map(() => {
    return query(`
    [:find (pull ?u [*])
     :where 
     [?u ":user/login"]]
     `).flat();
  })
);

const notificationsAtom = atomWithObservable(() => notifications$);
const usersAtom = atomWithObservable(() => users$);

// different notification falls to different thread type. Namely, issue, pull request, commit, etc.
// we need to render each of the thread type in different ways
// for example, both issue & pull request can have comments, but
// issue may have labels, issue status and pull request may have different merge status
function Notification({ notification }: { notification: Notification }) {
  useEffect(() => {
    (async () => {
      if (["PullRequest", "Issue"].includes(notification.subject.type)) {
        const issue = await getIssue(notification.subject.url);
        transact(issueToDatoms(issue), "transact issue " + issue.url);
        const comments = await getIssueComments(issue.comments_url);
        comments.forEach(async (comment) => {
          transact(
            commentToDatoms(comment),
            "transact comment " + comment.body
          );
          const user = await getUser(comment.user.url);
          transact(userToDatoms(user), "transact user " + user.login);
        });
      }
    })();
  }, [notification]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{notification.subject.title}</CardTitle>
        <p>{notification.repository.full_name}</p>
      </CardHeader>
      <CardContent>
        <CardDescription>
          {formatDistance(new Date(notification.updated_at), new Date())}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

export function NotificationsByRepo() {
  const result = useAtomValue(notificationsAtom);
  const users = useAtomValue(usersAtom);
  console.log(users);
  const notificationsByRepo = result?.reduce((acc, notification) => {
    const repoName = notification.repository.full_name;
    if (!acc[repoName]) {
      acc[repoName] = [];
    }
    acc[repoName].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);
  return (
    <div className="flex gap-2 p-4 max-h-screen">
      {Object.entries(notificationsByRepo ?? {}).map(
        ([repoName, notifications]) => (
          <div
            key={repoName}
            className="flex flex-col gap-1 w-96 shrink-0 max-h-full overflow-auto p-1 pr-3"
          >
            <div className="font-semibold sticky top-0">{repoName}</div>
            {notifications.map((notification) => (
              <Notification key={notification.id} notification={notification} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function Notifications() {
  return <NotificationsByRepo />;
}
