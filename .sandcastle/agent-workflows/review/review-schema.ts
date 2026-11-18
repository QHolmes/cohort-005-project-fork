import { z } from "zod/v4";

// The decisions the review left for a person. The workflow posts each one as an
// inline comment on the pull request, on its file and line.
export const reviewSchema = z
  .strictObject({
    comments: z
      .array(
        z.strictObject({
          path: z
            .string()
            .min(1)
            .describe("The file, relative to the repository root."),
          line: z
            .number()
            .int()
            .positive()
            .describe(
              "A line in the file as it is now, inside a hunk of the diff against the base. A comment outside the hunks is dropped."
            ),
          body: z
            .string()
            .min(1)
            .describe(
              "The decision, in Markdown: the rule or spec line it concerns, the options, and what a person has to settle."
            ),
        })
      )
      .describe(
        "One entry per decision you left for a person. Work you fixed does not go here. Empty is fine."
      ),
  })
  .describe("The review's inline comments.");
