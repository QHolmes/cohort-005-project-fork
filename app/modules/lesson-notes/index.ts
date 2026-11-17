import { describeNoteEditor, type NoteEditorState } from "./lib/editor-status";

export type { NoteEditorState, NoteEditorStatus } from "./lib/editor-status";

/**
 * What the lesson note editor shows for the Student's current draft: the
 * character count, whether Save is offered, and the status line beside it.
 */
export function noteEditorState(input: {
  draft: string;
  savedBody: string | null;
  error?: string;
}): NoteEditorState {
  return describeNoteEditor(input);
}
