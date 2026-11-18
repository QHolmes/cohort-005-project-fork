import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteEditorStatus =
  | { kind: "error"; message: string }
  | { kind: "too-long"; over: number }
  | { kind: "unsaved" }
  | { kind: "saved" }
  | { kind: "blank" };

/** A failed save: the server's message, and the draft it refused. */
export type NoteSaveError = { message: string; draft: string };

export type NoteEditorState = {
  length: number;
  max: number;
  tooLong: boolean;
  canSave: boolean;
  status: NoteEditorStatus;
};

/**
 * What the lesson note editor shows for the Student's current draft: the
 * character count, whether Save is offered, and the status line beside it.
 */
export function noteEditorState({
  draft,
  savedBody,
  error,
}: {
  draft: string;
  savedBody: string | null;
  error?: NoteSaveError;
}): NoteEditorState {
  const length = draft.length;
  const over = length - MAX_NOTE_LENGTH;
  const tooLong = over > 0;
  const trimmed = draft.trim();
  // The save action trims the note before storing it, so compare what it
  // would store, or a trailing newline would read as unsaved for ever.
  const dirty = trimmed !== (savedBody ?? "");
  // The save action rejects a blank note, so the button must not offer it.
  const blank = trimmed.length === 0;

  return {
    length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    canSave: dirty && !blank && !tooLong,
    status: statusFor({
      // An error is about the draft that was sent; editing it moves on.
      error: error?.draft === draft ? error.message : undefined,
      tooLong,
      over,
      dirty,
      savedBody,
    }),
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
