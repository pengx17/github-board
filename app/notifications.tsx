import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDistance } from "date-fns";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useAtomValue } from "jotai";
import { atomWithObservable } from "jotai/utils";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useComments, useIssue, useUser } from "@/lib/data-hooks";

import { mdToHTML } from "@/lib/md-to-html";
import { notifications$ } from "@/lib/swr-resources";
import { Comment, Notification } from "@/types/github";
import { Suspense, startTransition, useState } from "react";
import { UserAvatar } from "./user";

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <Card key={comment.id}>
      <CardHeader>
        <CardTitle>
          <UserAvatar login={comment.user.login} />
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
  return (
    <>
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle>
            <UserAvatar login={issue?.user?.login} />
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
      {isIssue && <PrefetchIssue issueUrl={notification.subject.url} />}
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
    <div className="relative">
      <Card
        onClick={() => {
          console.log(notification);
          startTransition(() => {
            setOpen(true);
          });
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
      <Suspense
        fallback={
          <div className="absolute inset-0 bg-gray-50 opacity-40"></div>
        }
      >
        <DetailSheet
          open={open}
          onOpenChange={(open) => {
            setOpen(open);
          }}
          notification={notification}
        />
      </Suspense>
    </div>
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
    <div className="flex gap-2 p-4 max-h-screen h-full">
      {Object.entries(notificationsByRepo ?? {}).map(
        ([repoName, notifications]) => (
          <ScrollArea key={repoName} className="w-96 h-auto shrink-0">
            <div className="flex flex-col gap-2 p-1 pr-3">
              <div className="font-semibold sticky top-0 z-10">{repoName}</div>
              {notifications.map((notification) => (
                <Notification
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>
          </ScrollArea>
        )
      )}
    </div>
  );
}

export function Notifications() {
  return <NotificationsByRepo />;
}
