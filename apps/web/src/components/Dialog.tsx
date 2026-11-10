import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { en } from "../strings/en";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
}

/**
 * A modal dialog built on the browser's <dialog> element. showModal() makes the rest of the page
 * inert, traps Tab inside, and closes on Escape. We also remember the opener and give focus back.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  closeLabel = en.dialog.close,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The browser fires "close" for Escape, for dialog.close(), and for form method=dialog.
  const handleClose = () => {
    opener.current?.focus();
    opener.current = null;
    onClose();
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={handleClose}>
      <h2 id={titleId}>{title}</h2>
      {children}
      <div className="dialog__actions">
        <Button variant="secondary" onClick={() => ref.current?.close()}>
          {closeLabel}
        </Button>
      </div>
    </dialog>
  );
}
