import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useUserReferences, useUsers } from "@/lib/data-hooks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Suspense, useState } from "react";
import { mdToHTML } from "@/lib/md-to-html";
import { Button } from "@/components/ui/button";

export const UsersSheet = () => {
  const [open, setOpen] = useState(false);
  return (
    <Suspense fallback="loading ...">
      <Button
        className="fixed bottom-4 right-4"
        onClick={() => {
          setOpen(true);
        }}
      >
        Users
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <UsersAvatars />
        </SheetContent>
      </Sheet>
    </Suspense>
  );
};

export const UsersAvatars = () => {
  const users = useUsers();
  return (
    <div className="flex gap-2 flex-wrap">
      {users.map((user) => {
        return (
          <div className="bg-gray-100 rounded px-2">
            <UserAvatar key={user[":user/login"]} login={user[":user/login"]} />
          </div>
        );
      })}
    </div>
  );
};

export const UserAvatar = ({ login }: { login: string }) => {
  const user = useUser(login);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="flex gap-1 items-center cursor-default"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Avatar className="h-4 w-4">
          <AvatarFallback>{login?.[0]}</AvatarFallback>
          <AvatarImage src={user?.avatar_url} />
        </Avatar>
        {login}
        {user?.name && (
          <span className="text-gray-500 text-sm">({user.name})</span>
        )}
      </div>
      <ReferencesSheet open={open} onOpenChange={setOpen} login={login} />
    </>
  );
};

function getReferenceType(reference: any) {
  if (`:issue/canonical-name` in reference) {
    return reference[`:issue/pull?`] ? "pull" : "issue";
  } else if (`:comment/id` in reference) {
    return "comment";
  } else if (`:repository/id` in reference) {
    return "repository";
  } else {
    return "unknown";
  }
}
function Reference({ reference }: { reference: any }) {
  const type = getReferenceType(reference);

  switch (type) {
    case "issue":
      return (
        <div>
          <span className="text-gray-500">
            {reference[`:issue/canonical-name`]}
          </span>{" "}
          {reference[`:issue/title`]}
        </div>
      );
    case "pull":
      return (
        <div>
          <span className="text-gray-500">
            {reference[`:issue/canonical-name`]}
          </span>{" "}
          {reference[`:issue/title`]}
        </div>
      );
    case "comment":
      return (
        <div className="bg-gray-50 p-2">
          <span className="text-gray-500">
            {reference[`:issue/canonical-name`]}
          </span>{" "}
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: mdToHTML(reference[`:comment/body`]),
            }}
          />
        </div>
      );
    case "repository":
      return <div>{reference[`:repository/canonical-name`]}</div>;
    default:
      return <pre>{JSON.stringify(reference, null, 2)}</pre>;
  }
}

function ReferencesSheet({
  login,
  open,
  onOpenChange,
}: {
  open: boolean;
  login: string;
  onOpenChange: (open: boolean) => void;
}) {
  const references = useUserReferences(login);
  const groupedReferences = references.reduce((acc, reference) => {
    const type = getReferenceType(reference);
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(reference);
    return acc;
  }, {} as Record<string, any[]>);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader></SheetHeader>
          <SheetTitle>References ({references.length})</SheetTitle>
          <div className="flex flex-col gap-4">
            {Object.entries(groupedReferences).map(([type, references]) => {
              return (
                <div key={type}>
                  <h2 className="text-gray-700 text-lg font-bold">{type}</h2>
                  <div className="flex flex-col gap-1">
                    {(references as any[]).map((reference) => {
                      return (
                        <Reference
                          key={reference[`:issue/id`]}
                          reference={reference}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
