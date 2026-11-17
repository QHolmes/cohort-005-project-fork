import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteEditorStatus =
  | { kind: "error"; message: string }
  | { kind: "too-long"; over: number }
  | { kind: "unsaved" }
  | { kind: "saved" }
  | { kind: "blank" };

export type NoteEditorState = {
  length: number;
  max: number;
  tooLong: boolean;
  canSave: boolean;
  status: NoteEditorStatus;
};

export function describeNoteEditor({
  draft,
  savedBody,
  error,
}: {
  draft: string;
  savedBody: string | null;
  error?: string;
}): NoteEditorState {
  const length = draft.length;
  const over = length - MAX_NOTE_LENGTH;
  const tooLong = over > 0;
  const dirty = draft !== (savedBody ?? "");
  // The save action rejects a blank note, so the button must not offer it.
  const blank = draft.trim().length === 0;

  return {
    length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    canSave: dirty && !blank && !tooLong,
    status: statusFor({ error, tooLong, over, dirty, savedBody }),
  };
}

function statusFor({
  error,
  tooLong,
  over,
  dirty,
  savedBody,
}: {
  error?: string;
  tooLong: boolean;
  over: number;
  dirty: boolean;
  savedBody: string | null;
}): NoteEditorStatus {
  if (tooLong) return { kind: "too-long", over };
  if (error) return { kind: "error", message: error };
  if (dirty) return { kind: "unsaved" };
  if (savedBody !== null) return { kind: "saved" };
  return { kind: "blank" };
}
