import type { ReactNode } from "react";
import { CheckCheck } from "lucide-react";
import { fillTags, type Acknowledgement } from "@/lib/events/form-editor";

/** What a respondent sees once their answers are saved: the Acknowledgement step, filled in. `children` are further actions (Back to event). */
export function FormAcknowledgement({ acknowledgement, eventName, name, link, emailNote, children }: { acknowledgement: Acknowledgement; eventName: string; name?: string; link: string; emailNote?: string; children?: ReactNode }) {
  const fill = (text: string) => fillTags(text, { name, event: eventName, link });
  return (
    <section className="ev-done ev-evaluation-result ev-acknowledgement" role="status">
      <span className="ev-done-mark" aria-hidden="true"><CheckCheck size={24} /></span>
      <h2>{fill(acknowledgement.title)}</h2>
      {fill(acknowledgement.message).split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {emailNote && <p className="ev-field-hint">{emailNote}</p>}
      {(acknowledgement.link || children) && <div className="ev-actions">{acknowledgement.link && <a className="ev-button is-primary" href={link}>Public registration form</a>}{children}</div>}
    </section>
  );
}
