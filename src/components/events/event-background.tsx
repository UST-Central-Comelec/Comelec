import { Fragment, type ReactNode } from "react";
import { readBackground } from "@/lib/events/background";
import type { Run } from "@/lib/email/body";

function inline(runs: Run[]) {
  return runs.map((run, index) => {
    let text: ReactNode = run.text;
    if (run.bold) text = <strong>{text}</strong>;
    if (run.italic) text = <em>{text}</em>;
    if (run.href) text = <a href={run.href}>{text}</a>;
    return <Fragment key={index}>{text}</Fragment>;
  });
}

/** Render text as React nodes, never as HTML supplied by an author. */
export function EventBackground({ value, fallback }: { value: string; fallback: ReactNode }) {
  const body = readBackground(value);
  if (!body.length) return fallback;
  return <div className="event-background-content">{body.map((block, index) => block.type === "paragraph"
    ? <p key={index}>{inline(block.runs)}</p>
    : <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>)}</div>;
}
