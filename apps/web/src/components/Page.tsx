import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { en } from "../strings/en";

/** False until the person has gone to another screen. We do not move focus on the first load. */
export const NavigatedContext = createContext<RefObject<boolean>>({ current: false });

export interface PageProps {
  /** The visible h1. Also the start of the browser tab title. */
  title: string;
  children?: ReactNode;
  /**
   * Move focus to the heading even on first load. For a screen that replaces another without a
   * navigation (the family code after sign-up), so a screen reader still announces it.
   */
  focusHeading?: boolean;
}

/**
 * Every screen is a Page. When it appears after a navigation it sets the tab title and moves
 * focus to the h1, so a screen reader announces the new screen.
 */
export function Page({ title, children, focusHeading = false }: PageProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const navigated = useContext(NavigatedContext);

  useEffect(() => {
    document.title = title === en.appName ? en.appName : `${title} | ${en.appName}`;
    if (navigated.current || focusHeading) {
      heading.current?.focus();
    }
  }, [title, navigated, focusHeading]);

  return (
    <div className="stack">
      <h1 ref={heading} tabIndex={-1} className="page-heading">
        {title}
      </h1>
      {children}
    </div>
  );
}
