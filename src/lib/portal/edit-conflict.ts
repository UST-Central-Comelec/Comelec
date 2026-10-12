// Two people editing the same record (src/lib/data/edit-guard.ts): what the browser and server agree on.

/** The hidden fields an editor sends: the record as it was opened, and the version it chose to save over. */
export const STAMP_FIELD = "_editStamp";
export const OVERWRITE_FIELD = "_editOverwrite";

/** Someone else saved, and changed what this editor changed too. Nothing was saved. */
export type EditConflict = {
  /** Who saved last, by name when known. */
  by: string;
  at: string;
  /** Their version: sent back to save over it on purpose. */
  version: string;
  /** What you both changed, as the form labels it. Empty when it was only saved again just now. */
  fields: string[];
};

/** What an edit page hands its form: the stamp, and the record's key for "also editing". */
export type EditGuardInfo = { stamp: string; record: string };
