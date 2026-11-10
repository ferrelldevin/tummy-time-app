import { Button } from "../components/Button";
import { en } from "../strings/en";
import { updateNow, useUpdateView } from "./updates";

const t = en.update;

/**
 * "Update available", at the top of every screen while a new version waits on this phone.
 * A polite live region that is always on the page, so a screen reader hears the notice when it
 * appears without being interrupted. It stays until the update happens: no time limit.
 */
export function UpdateNotice() {
  const view = useUpdateView();
  return (
    <div className="update-slot" role="status">
      {view.ready ? (
        <div className="update-notice">
          <p>
            <strong>{t.title}</strong> {t.body}
          </p>
          {view.heldByTimer ? <p>{t.stopTimerFirst}</p> : null}
          <Button
            block
            onClick={() => {
              updateNow();
            }}
            disabled={view.updating}
          >
            {view.updating ? t.updating : t.button}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
