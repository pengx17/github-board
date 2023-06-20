import { Suspense } from "react";
import { Notifications } from "./notifications";

export function App() {
  return (
    <Suspense>
      <Notifications />
    </Suspense>
  );
}
