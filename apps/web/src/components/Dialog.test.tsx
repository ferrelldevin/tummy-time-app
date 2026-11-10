import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../test/axe";
import { en } from "../strings/en";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

afterEach(cleanup);

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="Example dialog"
      >
        <p>Body</p>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens as a modal with its title as the name", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Example dialog" });
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("closes with its Close button and gives focus back to the opener", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: en.dialog.close }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });

  it("closes when the browser reports Escape (a close event) and returns focus", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Example dialog" });
    dialog.removeAttribute("open");
    fireEvent(dialog, new Event("close"));
    expect(document.activeElement).toBe(opener);
  });

  it("has no axe violations when open", async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
