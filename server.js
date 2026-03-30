const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("node:vm");
const express = require("express");
const { commitChanges } = require("./scripts/commit");

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = __dirname;
const problemsDir = path.join(rootDir, "problems");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(rootDir, "public")));

function getProblemDir(slug) {
  return path.join(problemsDir, slug);
}

function extractSection(content, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?:\\n## |$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function parseProblem(slug) {
  const problemDir = getProblemDir(slug);
  const readmePath = path.join(problemDir, "README.md");
  const solutionPath = path.join(problemDir, "solution.js");
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
  const solution = fs.existsSync(solutionPath) ? fs.readFileSync(solutionPath, "utf8") : "";
  const title = readme.match(/^#\s+(.+)$/m)?.[1] || slug;
  const difficulty = extractSection(readme, "Difficulty").split("\n")[0] || "Unknown";
  const exampleTestcases = extractSection(readme, "Example Testcases");

  return {
    slug,
    title,
    difficulty,
    readme,
    solution,
    exampleTestcases,
  };
}

function isSolvedSolution(solution) {
  const trimmed = solution.trim();
  if (!trimmed) {
    return false;
  }

  return !/function solution\(\)\s*{\s*}\s*module\.exports = solution;/s.test(trimmed);
}

function listProblems() {
  if (!fs.existsSync(problemsDir)) {
    return [];
  }

  return fs
    .readdirSync(problemsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => parseProblem(entry.name))
    .map(({ readme, solution, ...problem }) => ({
      ...problem,
      solved: isSolvedSolution(solution),
      summary: extractSection(readme, "Description").replace(/<[^>]+>/g, " ").slice(0, 180).trim(),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function runSolution(code, tests) {
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    require,
    console,
  });

  new vm.Script(code, { filename: "solution.js" }).runInContext(context, { timeout: 1000 });

  const candidate = context.module.exports || context.exports;
  if (typeof candidate !== "function") {
    throw new Error("solution.js must export a function");
  }

  return tests.map((test, index) => {
    const args = Array.isArray(test.args) ? test.args : [];
    const actual = candidate(...args);
    let pass = true;
    let error = null;

    try {
      assert.deepStrictEqual(actual, test.expected);
    } catch (assertionError) {
      pass = false;
      error = assertionError.message;
    }

    return {
      index,
      pass,
      args,
      expected: test.expected,
      actual,
      error,
    };
  });
}

app.get("/api/problems", (_req, res) => {
  res.json({ problems: listProblems() });
});

app.get("/api/problems/:slug", (req, res) => {
  const problemDir = getProblemDir(req.params.slug);
  if (!fs.existsSync(problemDir)) {
    res.status(404).json({ error: "Problem not found" });
    return;
  }

  res.json(parseProblem(req.params.slug));
});

app.post("/api/run", (req, res) => {
  const { code, tests } = req.body;

  if (typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  if (!Array.isArray(tests) || tests.length === 0) {
    res.status(400).json({ error: "tests must be a non-empty array" });
    return;
  }

  try {
    const results = runSolution(code, tests);
    res.json({
      results,
      passed: results.every((result) => result.pass),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/save", (req, res) => {
  const { slug, code } = req.body;

  if (!slug || typeof code !== "string") {
    res.status(400).json({ error: "slug and code are required" });
    return;
  }

  const problemDir = getProblemDir(slug);
  if (!fs.existsSync(problemDir)) {
    res.status(404).json({ error: "Problem not found" });
    return;
  }

  fs.writeFileSync(path.join(problemDir, "solution.js"), code, "utf8");
  res.json({ ok: true });
});

app.post("/api/submit", (req, res) => {
  const { slug, code, message } = req.body;

  if (!slug || typeof code !== "string") {
    res.status(400).json({ error: "slug and code are required" });
    return;
  }

  const problemDir = getProblemDir(slug);
  if (!fs.existsSync(problemDir)) {
    res.status(404).json({ error: "Problem not found" });
    return;
  }

  try {
    fs.writeFileSync(path.join(problemDir, "solution.js"), code, "utf8");
    const result = commitChanges(message || `Solved ${slug}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(rootDir, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`LeetCode tracker running at http://localhost:${PORT}`);
});
