import { Comment, FullUser, Notification, Issue, User } from "@/types/github";
import datascript from "datascript";
import { Observable } from "rxjs";
import { omitBy, isNil } from "lodash-es";

export const schema = {
  // user
  ":user/id": {
    ":db/unique": ":db.unique/identity",
  },
  ":user/login": {
    ":db/unique": ":db.unique/identity",
  },
  ":user/avatar_url": {},
  ":user/name": {},
  ":user/type": {},

  // issue
  ":issue/id": {
    ":db/unique": ":db.unique/identity",
  },
  ":issue/canonical-name": {
    ":db/unique": ":db.unique/identity",
  },
  ":issue/title": {},
  ":issue/pull?": {},
  ":issue/state": {},
  ":issue/state-reason": {},
  ":issue/body": {},
  ":issue/created-at": {},
  ":issue/updated-at": {},
  ":issue/labels": {
    ":db/cardinality": ":db.cardinality/many",
    ":db/valueType": ":db.type/ref",
  },
  ":issue/user": {
    ":db/valueType": ":db.type/ref",
  },
  ":issue/assignees": {
    ":db/cardinality": ":db.cardinality/many",
    ":db/valueType": ":db.type/ref",
  },
  ":issue/repository": {
    ":db/valueType": ":db.type/ref",
  },

  // label
  ":label/id": {
    ":db/unique": ":db.unique/identity",
  },
  ":label/canonical-name": {
    ":db/unique": ":db.unique/identity",
  },
  ":label/name": {},
  ":label/color": {},
  ":label/description": {},

  ":comment/id": {
    ":db/unique": ":db.unique/identity",
  },
  ":comment/user": {
    ":db/valueType": ":db.type/ref",
  },
  ":comment/body": {},
  // references to other users, comments, issues, etc.
  ":comment/references": {
    ":db/cardinality": ":db.cardinality/many",
    ":db/valueType": ":db.type/ref",
  },
  ":comment/issue": {
    ":db/valueType": ":db.type/ref",
  },

  // repository
  ":repository/id": {
    ":db/unique": ":db.unique/identity",
  },
  ":repository/canonical-name": {
    ":db/unique": ":db.unique/identity",
  },
  ":repository/name": {},
  ":repository/owner": {
    ":db/valueType": ":db.type/ref",
  },

  // notification
  ":notification/id": {
    ":db/unique": ":db.unique/identity",
  },
  ":notification/unread?": {},
  ":notification/reason": {},
  ":notification/updated-at": {},
  ":notification/last-read-at": {},
  ":notification/subject": {
    ":db/valueType": ":db.type/ref",
  },
  ":notification/repository": {
    ":db/valueType": ":db.type/ref",
  },
};

const createEmptyConnection = () => {
  return datascript.create_conn(schema);
};

export const connection = createEmptyConnection();

export const userToDatoms = (user: FullUser | User) => {
  const datom = {
    ":user/id": user.id,
    ":user/login": user.login,
    ":user/avatar_url": user.avatar_url,
  };

  if ("type" in user) {
    return [
      {
        ...datom,
        ":user/name": user.name,
        ":user/type": user.type,
      },
    ];
  } else {
    return [datom];
  }
};

export const getReferencedUsersFromBody = (body: string) => {
  const regex = /@([a-zA-Z0-9-]+)/g;
  const matches = body.matchAll(regex);
  const users = Array.from(matches)
    .map((match) => match[1])
    .map((login) => [":user/login", login]);
  return users;
};

export const getReferencedIssuesFromBody = (
  canonicalRepo: string,
  body: string
) => {
  const canonicalNames = Array.from(
    body.matchAll(
      /github\.com\/repos\/([^/]+)\/([^/]+)\/(?:pulls|issues)\/(\d+)/g
    )
  ).map((match) => {
    const [, owner, repo, issueId] = match;
    return getIssueCanonicalName(`${owner}/${repo}`, Number(issueId));
  });
  const shortNames = Array.from(body.matchAll(/#(\d+)/g)).map((match) => {
    const [, issueId] = match;
    return getIssueCanonicalName(canonicalRepo, Number(issueId));
  });
  return [...canonicalNames, ...shortNames].map((name) => [
    ":issue/canonical-name",
    name,
  ]);
};

export const getIssueCanonicalName = (repo: string, issueId: number) => {
  return `issue:${repo}#${issueId}`;
};

export const getLabelCanonicalName = (repo: string, labelName: string) => {
  return `label:${repo}#${labelName}`;
};

export const getReferencesFromBody = (repo: string, body: string) => {
  const users = getReferencedUsersFromBody(body);
  const issues = getReferencedIssuesFromBody(repo, body);
  return [...users, ...issues];
};

export const parseIssueUrl = (url: string) => {
  const regex = /github\.com\/repos\/([^/]+)\/([^/]+)\/(?:pulls|issues)\/(\d+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error("Invalid URL format");
  }
  const [, owner, repo, id] = match;
  const canonicalRepo = `${owner}/${repo}`;
  return {
    owner,
    repo,
    issueId: Number(id),
    canonicalName: getIssueCanonicalName(canonicalRepo, Number(id)),
    canonicalRepo: canonicalRepo,
  };
};

export const commentToDatoms = (comment: Comment) => {
  const user = comment.user;
  const { canonicalRepo } = parseIssueUrl(comment.issue_url);
  const references = getReferencesFromBody(canonicalRepo, comment.body);

  return [
    ...userToDatoms(user),
    ...references.map((ref) => {
      return {
        [ref[0]]: ref[1],
      };
    }),
    {
      ":comment/id": comment.id,
      ":comment/user": [":user/login", user.login],
      ":comment/body": comment.body,
      ":comment/references": references,
    },
  ];
};

export const issueToDatoms = (issue: Issue) => {
  const { canonicalRepo } = parseIssueUrl(issue.url);
  const references = getReferencesFromBody(canonicalRepo, issue.body || "");
  const labels = issue.labels.map((label) => {
    return {
      ":label/id": String(label.id),
      ":label/canonical-name": getLabelCanonicalName(canonicalRepo, label.name),
      ":label/name": label.name,
      ":label/color": label.color,
      ":label/description": label.description,
    };
  });

  const assignees = issue.assignees.map((assignee) => {
    return {
      ":user/login": assignee.login,
    };
  });

  return [
    ...userToDatoms(issue.user),
    ...labels,
    ...assignees,
    ...references.map((ref) => {
      return {
        [ref[0]]: ref[1],
      };
    }),
    [":user/login", issue.user.login],
    {
      ":issue/id": String(issue.id),
      ":issue/canonical-name": getIssueCanonicalName(
        canonicalRepo,
        issue.number
      ),
      ":issue/title": issue.title,
      ":issue/pull?": issue.url.match(/\/pulls\/(\d+)/) !== null,
      ":issue/state": issue.state,
      ":issue/state-reason": issue.state_reason,
      ":issue/body": issue.body,
      ":issue/created-at": issue.created_at,
      ":issue/updated-at": issue.updated_at,
      ":issue/assignees": assignees,
      ":issue/labels": labels.map((label) => [
        ":label/canonical-name",
        label[":label/canonical-name"],
      ]),
      ":issue/user": [":user/login", issue.user.login],
      ":issue/references": references,
      ":issue/repository": [":repository/canonical-name", canonicalRepo],
    },
  ];
};

export const notificationToDatoms = (notification: Notification) => {
  const isIssue =
    notification.subject.type === "Issue" ||
    notification.subject.type === "PullRequest";
  const datom: any = {
    ":notification/id": String(notification.id),
    ":notification/unread?": notification.unread,
    ":notification/reason": notification.reason,
    ":notification/updated-at": notification.updated_at,
    ":notification/last-read-at": notification.last_read_at,
  };
  const otherDatoms: any[] = [];
  if (isIssue) {
    const { canonicalName, canonicalRepo } = parseIssueUrl(
      notification.subject.url
    );
    otherDatoms.push({
      ":issue/canonical-name": canonicalName,
      ":issue/title": notification.subject.title,
    });
    otherDatoms.push({
      ":repository/canonical-name": canonicalRepo,
    });
    datom[":notification/subject"] = [":issue/canonical-name", canonicalName];
    datom[":notification/repository"] = [
      ":repository/canonical-name",
      canonicalRepo,
    ];
  }
  return [...otherDatoms, datom];
};

export const transact = (datoms: any[], message?: string) => {
  const sanitizedDatoms = datoms
    .map((datom) => omitBy(datom, isNil))
    .filter((datom) => Object.keys(datom).length > 0);
  return datascript.transact(connection, sanitizedDatoms, message);
};

export const query = (q: string, ...args: any[]) => {
  const result = datascript.q(q, datascript.db(connection), ...args);
  console.log("query", q, args, result);
  return result;
};

export const datoms$ = new Observable<void>((subscriber) => {
  const onChange = () => {
    subscriber.next();
  };
  datascript.listen(connection, "datoms", onChange);
  return () => {
    datascript.unlisten(connection, "datoms", onChange);
  };
});
