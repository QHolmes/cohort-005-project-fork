import { readFileSync } from "node:fs";
import ts from "typescript";

const ALLOWED = [
  /^\/\/ See ADR-\d{4}$/,
  /^\/[/*]\s*(oxlint|eslint)-(disable|enable)/,
  /^\/\/\s*biome-ignore/,
  /^\/\/\s*@ts-expect-error/,
];

const scriptKindFor = (file) =>
  file.endsWith(".tsx") || file.endsWith(".jsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;

const commentsIn = (file) => {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file)
  );
  const found = new Map();
  const jsxText = [];
  const collect = (ranges) => {
    for (const range of ranges ?? []) {
      found.set(range.pos, text.slice(range.pos, range.end));
    }
  };
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      jsxText.push([node.pos, node.end]);
      return;
    }
    collect(ts.getLeadingCommentRanges(text, node.pos));
    collect(ts.getTrailingCommentRanges(text, node.end));
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  const insideJsxText = (pos) =>
    jsxText.some(([start, end]) => pos >= start && pos < end);
  return [...found]
    .filter(([pos]) => !insideJsxText(pos))
    .map(([pos, comment]) => ({
      line: source.getLineAndCharacterOfPosition(pos).line + 1,
      comment,
    }));
};

const offending = process.argv
  .slice(2)
  .map((file) => file.replaceAll("\\", "/").replace(`${process.cwd()}/`, ""))
  .flatMap((file) =>
    commentsIn(file)
      .filter(({ comment }) => !ALLOWED.some((rule) => rule.test(comment)))
      .map(({ line, comment }) => ({ file, line, comment }))
  );

if (offending.length > 0) {
  console.error("These files have comments:");
  for (const { file, line, comment } of offending) {
    const firstLine = comment.split("\n")[0].slice(0, 100);
    console.error(`  ${file}:${line}: ${firstLine}`);
  }
  console.error(`
Code in app/ and scripts/ carries no comments. Every commit that touches a
file removes all of its comments, the old ones too. For each one:

- It says what the code does: delete it. If the code is unclear without it,
  rename or extract until it is clear.
- It records a decision (a constraint, a product call, a reason something is
  the way it is): write it up as an ADR in docs/adr/, following
  .agents/skills/domain-modeling/ADR-FORMAT.md, and list the ADR under
  "## Decisions" in the PR body. Where an agent editing this code needs to
  find the ADR, leave exactly one line: // See ADR-NNNN

Lint directives (oxlint-disable, eslint-disable, biome-ignore,
@ts-expect-error) stay.

When you are done, commit again.`);
  process.exit(1);
}
