import type { ReactNode } from "react";

export interface CardProps {
  title?: string;
  headingLevel?: 2 | 3;
  children: ReactNode;
}

/** A grouped block of content. With a title it gets a heading. */
export function Card({ title, headingLevel = 2, children }: CardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="card">
      {title ? <Heading>{title}</Heading> : null}
      {children}
    </div>
  );
}
