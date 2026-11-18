import { execFileSync } from "node:child_process";
import ts from "typescript";

const CONFIG = ".oxlintrc.json";

const readAt = (revision) => {
  try {
    return execFileSync("git", ["show", `${revision}:${CONFIG}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
};

const exemptions = (text) => {
  if (text === null) return new Set();
  const { config, error } = ts.parseConfigFileTextToJson(CONFIG, text);
  if (error) {
    console.error(`${CONFIG} does not parse.`);
    process.exit(1);
  }
  const pairs = new Set();
  for (const override of config.overrides ?? []) {
    const offRules = Object.entries(override.rules ?? {})
      .filter(([, setting]) => [setting].flat()[0] === "off")
      .map(([rule]) => rule);
    for (const file of override.files ?? []) {
      for (const rule of offRules) pairs.add(`${rule} for ${file}`);
    }
  }
  return pairs;
};

const before = exemptions(readAt("HEAD"));
const added = [...exemptions(readAt(""))].filter((pair) => !before.has(pair));

if (added.length > 0) {
  console.error(`This commit adds lint exemptions to ${CONFIG}:`);
  for (const pair of added) console.error(`  ${pair}`);
  console.error(`
The exemption lists only shrink. Make the new code pass the rule instead:
split the long function, flatten the nesting, type the value. A file split
out of an exempt file passes the rules on its own; it does not inherit the
old file's entries.

When you are done, commit again.`);
  process.exit(1);
}
