const { useEffect, useMemo, useRef, useState } = React;

function MonacoEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    let disposed = false;

    window.require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs",
      },
    });

    window.require(["vs/editor/editor.main"], () => {
      if (disposed || !containerRef.current) {
        return;
      }

      editorRef.current = window.monaco.editor.create(containerRef.current, {
        value,
        language: "javascript",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        roundedSelection: false,
        scrollBeyondLastLine: false,
      });

      editorRef.current.onDidChangeModelContent(() => {
        onChange(editorRef.current.getValue());
      });
    });

    return () => {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return <div ref={containerRef} className="h-[28rem] w-full overflow-hidden rounded-2xl border border-stone-800" />;
}

function extractDescriptionHtml(readme) {
  const match = readme.match(/## Description\s+([\s\S]*?)(?:\n## |$)/);
  return match ? match[1].trim() : "<p>No description available.</p>";
}

function defaultTests(exampleTestcases) {
  const lines = exampleTestcases
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return JSON.stringify(
      [
        {
          args: [JSON.parse(lines[0]), JSON.parse(lines[1])],
          expected: [],
        },
      ],
      null,
      2
    );
  }

  return JSON.stringify(
    [
      {
        args: [],
        expected: null,
      },
    ],
    null,
    2
  );
}

function App() {
  const [problems, setProblems] = useState([]);
  const [activeSlug, setActiveSlug] = useState(() => window.location.hash.replace("#/problems/", ""));
  const [activeProblem, setActiveProblem] = useState(null);
  const [code, setCode] = useState("");
  const [testsText, setTestsText] = useState("[]");
  const [runResult, setRunResult] = useState(null);
  const [status, setStatus] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/problems")
      .then((response) => response.json())
      .then((data) => setProblems(data.problems || []));
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveSlug(window.location.hash.replace("#/problems/", ""));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!activeSlug) {
      setActiveProblem(null);
      return;
    }

    fetch(`/api/problems/${activeSlug}`)
      .then((response) => response.json())
      .then((data) => {
        setActiveProblem(data);
        setCode(data.solution);
        setTestsText(defaultTests(data.exampleTestcases || ""));
        setRunResult(null);
      });
  }, [activeSlug]);

  const filteredProblems = useMemo(() => {
    return problems.filter((problem) => {
      const difficultyMatch = difficultyFilter === "All" || problem.difficulty === difficultyFilter;
      const solvedMatch =
        statusFilter === "All" ||
        (statusFilter === "Solved" && problem.solved) ||
        (statusFilter === "Unsolved" && !problem.solved);
      const searchMatch =
        !search ||
        problem.title.toLowerCase().includes(search.toLowerCase()) ||
        problem.slug.toLowerCase().includes(search.toLowerCase());

      return difficultyMatch && solvedMatch && searchMatch;
    });
  }, [difficultyFilter, problems, search, statusFilter]);

  const solvedCount = problems.filter((problem) => problem.solved).length;

  async function saveSolution() {
    if (!activeProblem) {
      return;
    }

    setStatus("Saving...");
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: activeProblem.slug, code }),
    });
    const data = await response.json();
    setStatus(data.error || "Saved");
  }

  async function runTests() {
    try {
      setStatus("Running tests...");
      const tests = JSON.parse(testsText);
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tests }),
      });
      const data = await response.json();
      setRunResult(data);
      setStatus(data.error || (data.passed ? "All tests passed" : "Some tests failed"));
    } catch (error) {
      setRunResult(null);
      setStatus(error.message);
    }
  }

  async function submitSolution() {
    if (!activeProblem) {
      return;
    }

    setStatus("Submitting...");
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: activeProblem.slug,
        code,
        message: `Solved ${activeProblem.title}`,
      }),
    });
    const data = await response.json();
    setStatus(data.error || data.message || "Submitted");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-6 p-6">
      <aside className="glass w-full max-w-sm rounded-3xl border border-stone-800 p-5 shadow-2xl shadow-black/30">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-orange-300">Practice Hub</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-50">LeetCode Tracker</h1>
          <p className="mt-3 text-sm text-stone-400">
            {solvedCount} solved across {problems.length} tracked problems.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-3">
            <div className="text-xs uppercase tracking-wide text-stone-500">Solved</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-300">{solvedCount}</div>
          </div>
          <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-3">
            <div className="text-xs uppercase tracking-wide text-stone-500">Focus</div>
            <div className="mt-2 text-2xl font-semibold text-sky-300">{activeProblem?.difficulty || "MVP"}</div>
          </div>
        </div>

        <input
          className="mb-3 w-full rounded-2xl border border-stone-800 bg-stone-950/70 px-4 py-3 text-sm outline-none placeholder:text-stone-500"
          placeholder="Search problems"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="mb-4 flex gap-2">
          {["All", "Easy", "Medium", "Hard"].map((level) => (
            <button
              key={level}
              className={`rounded-full px-3 py-2 text-xs font-medium ${
                difficultyFilter === level ? "bg-orange-400 text-stone-950" : "bg-stone-900 text-stone-300"
              }`}
              onClick={() => setDifficultyFilter(level)}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="mb-4 flex gap-2">
          {["All", "Solved", "Unsolved"].map((value) => (
            <button
              key={value}
              className={`rounded-full px-3 py-2 text-xs font-medium ${
                statusFilter === value ? "bg-sky-300 text-stone-950" : "bg-stone-900 text-stone-300"
              }`}
              onClick={() => setStatusFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="space-y-3 overflow-y-auto pr-1">
          {filteredProblems.map((problem) => (
            <button
              key={problem.slug}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                activeSlug === problem.slug
                  ? "border-orange-300 bg-orange-400/10"
                  : "border-stone-800 bg-stone-900/70 hover:border-stone-700"
              }`}
              onClick={() => {
                window.location.hash = `/problems/${problem.slug}`;
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-stone-100">{problem.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-stone-500">{problem.slug}</div>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-stone-950 px-2 py-1 text-xs text-stone-300">{problem.difficulty}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      problem.solved ? "bg-emerald-400/20 text-emerald-300" : "bg-stone-800 text-stone-400"
                    }`}
                  >
                    {problem.solved ? "Solved" : "Open"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="glass flex-1 rounded-3xl border border-stone-800 p-6 shadow-2xl shadow-black/30">
        {!activeProblem ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-stone-800 bg-stone-950/30">
            <div className="max-w-md text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Select a Problem</p>
              <h2 className="mt-4 text-4xl font-semibold text-stone-50">Practice from your own repo</h2>
              <p className="mt-4 text-sm leading-6 text-stone-400">
                Choose a problem on the left to load the description, editor, and custom test runner.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-orange-300">{activeProblem.difficulty}</p>
                  <h2 className="mt-2 text-3xl font-semibold text-stone-50">{activeProblem.title}</h2>
                </div>
                <div className="rounded-full border border-stone-800 bg-stone-950/60 px-4 py-2 text-sm text-stone-300">
                  {activeProblem.slug}
                </div>
              </div>

              <article
                className="description rounded-3xl border border-stone-800 bg-stone-950/50 p-5 text-sm leading-7 text-stone-300"
                dangerouslySetInnerHTML={{ __html: extractDescriptionHtml(activeProblem.readme) }}
              />

              <div className="mt-6 rounded-3xl border border-stone-800 bg-stone-950/50 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-stone-100">Custom Tests</h3>
                  <span className="text-xs text-stone-500">Format: [{`{ args: [...], expected: ... }`}]</span>
                </div>
                <textarea
                  className="h-44 w-full rounded-2xl border border-stone-800 bg-stone-950/80 p-4 font-mono text-sm text-stone-200 outline-none"
                  value={testsText}
                  onChange={(event) => setTestsText(event.target.value)}
                />
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-stone-100">Solution</h3>
                <div className="text-sm text-stone-400">{status}</div>
              </div>

              <MonacoEditor value={code} onChange={setCode} />

              <div className="mt-4 flex flex-wrap gap-3">
                <button className="rounded-full bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950" onClick={runTests}>
                  Run Tests
                </button>
                <button className="rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-stone-950" onClick={saveSolution}>
                  Save
                </button>
                <button className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-medium text-stone-950" onClick={submitSolution}>
                  Submit
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-stone-800 bg-stone-950/50 p-5">
                <h3 className="text-lg font-medium text-stone-100">Run Results</h3>
                <pre className="mt-3 overflow-x-auto text-sm leading-6 text-stone-300">
                  {runResult ? JSON.stringify(runResult, null, 2) : "No test run yet."}
                </pre>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
