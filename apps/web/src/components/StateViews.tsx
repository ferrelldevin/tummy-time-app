import type { ReactNode } from "react";
import { en } from "../strings/en";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Card } from "./Card";
import { Spinner } from "./Spinner";

/** Standard state: something is loading. */
export function LoadingState({ label }: { label?: string }) {
  return <Spinner {...(label ? { label } : {})} />;
}

/** Standard state: nothing to show yet. Pass an action when there is something to do next. */
export function EmptyState({
  title = en.states.emptyTitle,
  body = en.states.emptyBody,
  action,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <Card title={title} headingLevel={2}>
      <p>{body}</p>
      {action}
    </Card>
  );
}

/** Standard state: it failed. Always gives a way forward, which is a Try again button. */
export function ErrorState({
  onRetry,
  title = en.states.errorTitle,
  body = en.states.errorBody,
}: {
  onRetry: () => void;
  title?: string;
  body?: string;
}) {
  return (
    <div className="stack">
      <Alert kind="error">
        <strong>{title}</strong> {body}
      </Alert>
      <Button onClick={onRetry}>{en.states.tryAgain}</Button>
    </div>
  );
}

/** Standard state: no connection. Calm, and says what still works. */
export function OfflineNotice() {
  return (
    <Alert kind="info">
      <strong>{en.states.offlineTitle}.</strong> {en.states.offlineBody}
    </Alert>
  );
}
