import { Suspense } from "react";
import { Notifications } from "./notifications";
import { UsersSheet } from "./user";

export function App() {
  return (
    <Suspense>
      <Notifications />
      <UsersSheet />
    </Suspense>
  );
}
