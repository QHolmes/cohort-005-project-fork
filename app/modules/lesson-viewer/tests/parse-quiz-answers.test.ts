import { describe, it, expect } from "vitest";
import { lessonViewer } from "../index.server";

function entries(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form.entries();
}

describe("lessonViewer.parseQuizAnswers", () => {
  it("maps each question field to the chosen option", () => {
    expect(
      lessonViewer.parseQuizAnswers(
        entries({ "question-3": "12", "question-7": "40" })
      )
    ).toEqual({ 3: 12, 7: 40 });
  });

  it("ignores fields that are not answers", () => {
    expect(
      lessonViewer.parseQuizAnswers(
        entries({ intent: "submit-quiz", quizId: "5", "question-3": "12" })
      )
    ).toEqual({ 3: 12 });
  });

  it("ignores a numeric field that lacks the question prefix", () => {
    expect(lessonViewer.parseQuizAnswers(entries({ "7": "12" }))).toEqual({});
  });

  it("drops an answer whose question or option is not a number", () => {
    expect(
      lessonViewer.parseQuizAnswers(
        entries({ "question-x": "12", "question-4": "abc", "question-5": "9" })
      )
    ).toEqual({ 5: 9 });
  });

  it("returns no answers for an empty form", () => {
    expect(lessonViewer.parseQuizAnswers(entries({}))).toEqual({});
  });
});
