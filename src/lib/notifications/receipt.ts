// A receipt inside an email: what someone sent through a form, grouped the way the form's own
// receipt groups it. The forms describe their answers as titled groups of [label, value] rows
// (describeAnswers, describeAccessRequest); this turns those into the email kit's blocks.
//
// Free of server-only imports.

import { details, detailsText, heading, type Details } from "@/lib/email/template";

export type ReceiptSection = { title: string; rows: Array<[label: string, value: string]> };

const isLink = (value: string) => /^https?:\/\/\S+$/i.test(value);

/** What a link's row shows in place of a long address: where it leads. */
const linkLabel = (href: string) => (/^https:\/\/(drive|docs)\.google\.com\//i.test(href) ? "Google Drive link" : href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""));

/** A section's answered rows, with a link in place of an address that was typed. */
const rowsOf = (section: ReceiptSection): Details => section.rows.filter(([, value]) => value.trim()).map(([label, value]): Details[number] => (isLink(value.trim()) ? [label, linkLabel(value.trim()), value.trim()] : [label, value]));

/** The sections that have anything in them. */
const answered = (sections: readonly ReceiptSection[]) => sections.map((section) => ({ title: section.title, rows: rowsOf(section) })).filter((section) => section.rows.length);

/** The receipt as the email's blocks: each section's title over its rows. */
export const receiptBlocks = (sections: readonly ReceiptSection[]) => answered(sections).flatMap((section) => [heading(section.title), details(section.rows)]);

/** The same, for the text version of the email. */
export const receiptText = (sections: readonly ReceiptSection[]) => answered(sections).map((section) => `${section.title}\n${detailsText(section.rows)}`).join("\n\n");
