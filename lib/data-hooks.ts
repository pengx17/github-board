import { atom, useAtomValue } from "jotai";
import { atomWithObservable } from "jotai/utils";
import { useMemo } from "react";
import { datoms$, parseIssueUrl, query } from "./datascript";
import { getComments$, getIssue$, getUser$ } from "./swr-resources";
import { debounceTime, map, merge, of } from "rxjs";
import { FullUser } from "@/types/github";

export function useUser(login: string) {
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

export function useIssue(issueUrl: string) {
  const issueAtom = useMemo(() => {
    return atomWithObservable(() => {
      const { canonicalRepo, issueId } = parseIssueUrl(issueUrl);
      return getIssue$(canonicalRepo, issueId);
    });
  }, [issueUrl]);
  return useAtomValue(issueAtom);
}

export function useComments(issueUrl: string) {
  const commentsAtom = useMemo(() => {
    return atomWithObservable(() => {
      const { canonicalRepo, issueId } = parseIssueUrl(issueUrl);
      return getComments$(canonicalRepo, issueId);
    });
  }, [issueUrl]);
  const comments = useAtomValue(commentsAtom);
  return comments;
}

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

function queryUsers() {
  const result = query(`
    [:find (pull ?u [*])
    :where
    [?u ":user/login"]]
  `).flat();
  return result;
}

export function useUserReferences(login: string): any[] {
  const resultAtom = useMemo(() => {
    return atomWithObservable(() => {
      return merge(of(0), datoms$.pipe(debounceTime(500))).pipe(
        map(() => queryLoginReferences(login))
      );
    });
  }, [login]);
  const result = useAtomValue(resultAtom);
  return result;
}

export function useUsers(): any[] {
  const resultAtom = useMemo(() => {
    return atomWithObservable(() => {
      return merge(of(0), datoms$.pipe(debounceTime(1500))).pipe(
        map(() => queryUsers())
      );
    });
  }, []);
  const result = useAtomValue(resultAtom);
  return result;
}
