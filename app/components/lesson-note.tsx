import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { noteEditorState, type NoteEditorStatus } from "~/modules/lesson-notes";

export type LessonNoteData = { body: string; updatedAt: string } | null;

/**
 * The Student's private note on a lesson. It shares its card, header and
 * footer with the Questions & Discussion thread so the two read as one page.
 */
export function LessonNote({ note }: { note: LessonNoteData }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isSaving = fetcher.state !== "idle";
  const [draft, setDraft] = useState(note?.body ?? "");
  const state = noteEditorState({
    draft,
    savedBody: note?.body ?? null,
    error: fetcher.data?.error,
  });

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <NoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            rows={5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What stood out in this lesson?"
            aria-label="Your notes"
            className="resize-y"
          />

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !state.canSave}
            >
              {isSaving ? "Saving..." : "Save note"}
            </Button>

            <NoteStatus status={state.status} updatedAt={note?.updatedAt} />

            <span
              className={cn(
                "ml-auto text-xs",
                state.tooLong ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {state.length} / {state.max}
            </span>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteHeader() {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Private
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Jot things down while you watch. Only you can see these.
      </p>
    </>
  );
}

function NoteStatus({
  status,
  updatedAt,
}: {
  status: NoteEditorStatus;
  updatedAt: string | undefined;
}) {
  switch (status.kind) {
    case "error":
      return <span className="text-xs text-destructive">{status.message}</span>;
    case "too-long":
      return (
        <span className="text-xs text-destructive">
          {status.over.toLocaleString("en")} characters over the limit
        </span>
      );
    case "unsaved":
      return (
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      );
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground"
        >
          {updatedAt ? `Saved ${formatRelativeTime(updatedAt)}` : "Saved"}
        </span>
      );
    case "blank":
      return null;
  }
}
