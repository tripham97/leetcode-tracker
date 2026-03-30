const { spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git command failed").trim());
  }

  return (result.stdout || "").trim();
}

function commitChanges(message = "leetcode update") {
  runGit(["add", "."]);

  try {
    runGit(["commit", "-m", message]);
  } catch (error) {
    if (error.message.includes("nothing to commit")) {
      return { ok: true, message: "Nothing to commit" };
    }

    throw error;
  }

  runGit(["push"]);
  return { ok: true, message: `Committed and pushed: ${message}` };
}

if (require.main === module) {
  const message = process.argv[2] || "leetcode update";

  try {
    const result = commitChanges(message);
    console.log(result.message);
  } catch (error) {
    console.error("Commit failed:", error.message);
    process.exit(1);
  }
}

module.exports = { commitChanges };
