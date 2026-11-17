import { describe, it, expect } from "vitest";
import { noteEditorState } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("noteEditorState", () => {
  it("offers nothing to save on an empty, never-saved note", () => {
    const state = noteEditorState({ draft: "", savedBody: null });
    expect(state).toEqual({
      length: 0,
      max: MAX_NOTE_LENGTH,
      tooLong: false,
      canSave: false,
      status: { kind: "blank" },
    });
  });

  it("offers Save once the Student has typed something new", () => {
    const state = noteEditorState({ draft: "generics", savedBody: null });
    expect(state.canSave).toBe(true);
    expect(state.length).toBe(8);
    expect(state.status).toEqual({ kind: "unsaved" });
  });

  it("shows the note as saved when the draft matches what is stored", () => {
    const state = noteEditorState({ draft: "generics", savedBody: "generics" });
    expect(state.canSave).toBe(false);
    expect(state.status).toEqual({ kind: "saved" });
  });

  it("marks an edit to a saved note as unsaved", () => {
    const state = noteEditorState({
      draft: "generics!",
      savedBody: "generics",
    });
    expect(state.canSave).toBe(true);
    expect(state.status).toEqual({ kind: "unsaved" });
  });

  it("does not offer to save a draft that is only whitespace", () => {
    const state = noteEditorState({ draft: "   \n", savedBody: "generics" });
    expect(state.canSave).toBe(false);
    expect(state.status).toEqual({ kind: "unsaved" });
  });

  it("accepts a draft of exactly the maximum length", () => {
    const draft = "a".repeat(MAX_NOTE_LENGTH);
    const state = noteEditorState({ draft, savedBody: null });
    expect(state.tooLong).toBe(false);
    expect(state.canSave).toBe(true);
  });

  it("refuses a draft over the maximum and says by how much", () => {
    const draft = "a".repeat(MAX_NOTE_LENGTH + 3);
    const state = noteEditorState({ draft, savedBody: null, error: "nope" });
    expect(state.tooLong).toBe(true);
    expect(state.canSave).toBe(false);
    expect(state.status).toEqual({ kind: "too-long", over: 3 });
  });

  it("shows the server's error for a draft within the limit", () => {
    const state = noteEditorState({
      draft: "generics",
      savedBody: null,
      error: "Something went wrong",
    });
    expect(state.status).toEqual({
      kind: "error",
      message: "Something went wrong",
    });
  });
});
