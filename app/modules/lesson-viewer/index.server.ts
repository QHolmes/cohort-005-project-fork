import {
  loadFullLesson,
  loadLessonOutline,
  type LessonOutline,
} from "./lib/lesson-page";
import { markLessonComplete } from "./lib/progress";
import { getCommentById } from "./lib/thread";
import {
  gradeAndRecordAttempt,
  findLessonQuiz,
  parseQuizAnswers,
} from "./lib/quiz";

export type { LessonOutline };
export type FullLesson = Awaited<ReturnType<typeof loadFullLesson>>;

/**
 * What the lesson page reads and writes: its outline, the full lesson for
 * someone who may view it, progress, the discussion and the quiz. Permission
 * checks stay with the caller (see the permissions module).
 */
export const lessonViewer = {
  loadLessonOutline,
  loadFullLesson,
  markLessonComplete,

  /** The comment with this id, only if it is on this lesson. */
  findLessonComment(commentId: number, lessonId: number) {
    const comment = getCommentById(commentId);
    return comment && comment.lessonId === lessonId ? comment : null;
  },

  findLessonQuiz,
  parseQuizAnswers,
  submitQuiz: gradeAndRecordAttempt,
};
