import { Comment, FullUser, Issue, User } from "@/types/github";
import datascript from "datascript";
import { Observable } from "rxjs";

export const schema = {
  ":user/id": {
    ":db/unique": ":db.unique/identity",
  },
  ":user/login": {
    ":db/unique": ":db.unique/identity",
  },
  ":user/avatar_url": {},
  ":user/name": {},
  ":user/type": {},

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
};

const createEmptyConnection = () => {
  return datascript.create_conn(schema);
};

export const connection = createEmptyConnection();

export const userToDatoms = (user: FullUser | User) => {
  const datom = {
    ":user/id": String(user.id),
    ":user/login": user.login,
    ":user/avatar_url": user.avatar_url,
  };

  if ("type" in user) {
    return [
      {
        ...datom,
        ":user/name": user.name || "",
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

export const getReferencedIssuesFromBody = (repo: string, body: string) => {
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
    return getIssueCanonicalName(repo, Number(issueId));
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

export const getRepoFromIssueUrl = (url: string) => {
  const regex = /github\.com\/repos\/([^/]+)\/([^/]+)\/(?:pulls|issues)\/(\d+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error("Invalid URL format");
  }
  const [, owner, repo] = match;
  return `${owner}/${repo}`;
};

export const commentToDatoms = (comment: Comment) => {
  const user = comment.user;
  const repo = getRepoFromIssueUrl(comment.issue_url);
  const references = getReferencesFromBody(repo, comment.body);

  return [
    ...userToDatoms(user),
    ...references.map((ref) => {
      return {
        [ref[0]]: ref[1],
      };
    }),
    {
      "comment/id": comment.id,
      "comment/user": [":user/login", user.login],
      "comment/body": comment.body,
      "comment/references": references,
    },
  ];
};

export const issueToDatoms = (issue: Issue) => {
  const repo = getRepoFromIssueUrl(issue.url);
  const references = getReferencesFromBody(repo, issue.body || "");
  const labels = issue.labels.map((label) => {
    return {
      "label/id": String(label.id),
      "label/canonical-name": getLabelCanonicalName(repo, label.name),
      "label/name": label.name,
      "label/color": label.color,
      "label/description": label.description || "",
    };
  });

  return [
    ...userToDatoms(issue.user),
    ...labels,
    ...references.map((ref) => {
      return {
        [ref[0]]: ref[1],
      };
    }),
    {
      "issue/id": String(issue.id),
      "issue/canonical-name": getIssueCanonicalName(repo, issue.number),
      "issue/title": issue.title,
      "issue/pull?": issue.url.match(/\/pulls\/(\d+)/) !== null,
      "issue/state": issue.state,
      "issue/state-reason": issue.state_reason || "",
      "issue/body": issue.body || "",
      "issue/created-at": issue.created_at,
      "issue/updated-at": issue.updated_at,
      "issue/labels": labels.map((label) => [
        ":label/canonical-name",
        label["label/canonical-name"],
      ]),
    },

    ...references.map((ref) => {
      return {
        "issue/id": String(issue.id),
        "issue/references": ref,
      };
    }),
  ];
};

export const transact = (datoms: any[], message?: string) => {
  return datascript.transact(connection, datoms, message);
};

export const query = (q: string, ...args: any[]) => {
  const result = datascript.q(q, datascript.db(connection), ...args);
  console.log("query", q, args, result);
  return result;
};

export const datoms$ = new Observable<void>((subscriber) => {
  const onChange = () => {
    subscriber.next();
  }
  datascript.listen(connection, "datoms", onChange);
  return () => {
    datascript.unlisten(connection, "datoms", onChange);
  };
})
