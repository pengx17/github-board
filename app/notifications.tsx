import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDistance } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { atom, useAtomValue } from "jotai";
import { atomWithObservable } from "jotai/utils";

import {
  getComments$,
  getIssue$,
  getUser$,
  notifications$,
} from "@/lib/swr-resources";
import { Notification, Comment } from "@/types/github";
import { Suspense, useMemo, useState } from "react";
import { parseIssueUrl, query } from "@/lib/datascript";
import { mdToHTML } from "@/lib/md-to-html";

function queryLoginReferences(login?: string) {
  if (login) {
    const result = query(`
    [:find (pull ?i [*])
    :where
    [?u ":user/login" "${login}"]
    (or [?i ":issue/user" ?u]
        [?i ":issue/assignees" ?u]
        [?i ":issue/references" ?u]
        [?i ":comment/references" ?u]
        [?i ":comment/user" ?u]
        [?i ":repository/owner" ?u])]
  ]`).flat();
    return result;
  }
}

function useUser(login: string) {
  const userAtom = useMemo(() => {
    if (!login) {
      return atom(null);
    }
    return atomWithObservable(() => {
      return getUser$(login);
    });
  }, [login]);
  return useAtomValue(userAtom);
}

function useIssue(issueUrl: string) {
  const issueAtom = useMemo(() => {
    return atomWithObservable(() => {
      const { canonicalRepo, issueId } = parseIssueUrl(issueUrl);
      return getIssue$(canonicalRepo, issueId);
    });
  }, [issueUrl]);
  return useAtomValue(issueAtom);
}

function useComments(issueUrl: string) {
  const commentsAtom = useMemo(() => {
    return atomWithObservable(() => {
      const { canonicalRepo, issueId } = parseIssueUrl(issueUrl);
      return getComments$(canonicalRepo, issueId);
    });
  }, [issueUrl]);
  const comments = useAtomValue(commentsAtom);
  return comments;
}

function CommentCard({ comment }: { comment: Comment }) {
  const user = useUser(comment.user.login);
  return (
    <Card key={comment.id}>
      <CardHeader>
        <CardTitle
          className="flex gap-1 items-center"
          onClick={() => {
            console.log(queryLoginReferences(user?.login));
          }}
        >
          <Avatar className="h-4 w-4">
            <AvatarFallback>{user?.login?.[0]}</AvatarFallback>
            <AvatarImage src={user?.avatar_url} />
          </Avatar>
          {user?.login}
        </CardTitle>
        <CardDescription>
          {formatDistance(new Date(comment.updated_at), new Date())}
        </CardDescription>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none">
        <div
          dangerouslySetInnerHTML={{
            __html: mdToHTML(comment.body),
          }}
        ></div>
      </CardContent>
    </Card>
  );
}

function PrefetchIssue({ issueUrl }: { issueUrl: string }) {
  useComments(issueUrl);
  const issue = useIssue(issueUrl);
  useUser(issue?.user?.login);

  return null;
}

function IssueDetail({ issueUrl }: { issueUrl: string }) {
  const comments = useComments(issueUrl);
  const issue = useIssue(issueUrl);
  const user = useUser(issue?.user?.login);
  return (
    <>
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle
            className="flex gap-1 items-center"
            onClick={() => {
              console.log(queryLoginReferences(user?.login));
            }}
          >
            <Avatar className="h-4 w-4">
              <AvatarFallback>{user?.login?.[0]}</AvatarFallback>
              <AvatarImage src={user?.avatar_url} />
            </Avatar>
            {user?.login}
          </CardTitle>
          <CardDescription>
            {issue.updated_at &&
              formatDistance(new Date(issue.updated_at), new Date())}
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <div
            dangerouslySetInnerHTML={{
              __html: mdToHTML(issue.body),
            }}
          ></div>
        </CardContent>
      </Card>

      <SheetDescription className="flex flex-col gap-4">
        {comments.map((comment) => {
          return <CommentCard key={comment.id} comment={comment}></CommentCard>;
        })}
      </SheetDescription>
    </>
  );
}

function DetailSheet({
  notification,
  open,
  onOpenChange,
}: {
  open: boolean;
  notification: Notification;
  onOpenChange: (open: boolean) => void;
}) {
  const isIssue =
    notification.subject.type === "Issue" ||
    notification.subject.type === "PullRequest";
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{notification.subject.title}</SheetTitle>
            {isIssue && <IssueDetail issueUrl={notification.subject.url} />}
          </SheetHeader>
        </SheetContent>
      </Sheet>
      {isIssue && (
        <Suspense>
          <PrefetchIssue issueUrl={notification.subject.url} />
        </Suspense>
      )}
    </>
  );
}

const notificationsAtom = atomWithObservable(() => notifications$);

// different notification falls to different thread type. Namely, issue, pull request, commit, etc.
// we need to render each of the thread type in different ways
// for example, both issue & pull request can have comments, but
// issue may have labels, issue status and pull request may have different merge status
function Notification({ notification }: { notification: Notification }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card
        onClick={() => {
          setOpen(true);
        }}
      >
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
      <DetailSheet
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
        }}
        notification={notification}
      />
    </>
  );
}

export function NotificationsByRepo() {
  const result = useAtomValue(notificationsAtom);

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
