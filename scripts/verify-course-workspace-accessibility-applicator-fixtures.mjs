import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const applicatorSource = readFileSync(
  join(repoRoot, "scripts/apply-course-workspace-accessibility-patch.mjs"),
  "utf8",
);

function run(command, args, cwd, env = {}) {
  return spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "course-workspace-applicator-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "patches"), { recursive: true });
  mkdirSync(join(root, "src/components"), { recursive: true });

  writeFileSync(join(root, "scripts/apply-course-workspace-accessibility-patch.mjs"), applicatorSource);
  writeFileSync(
    join(root, "scripts/contract-stub.mjs"),
    'process.exit(Number.parseInt(process.env.CONTRACT_EXIT || "0", 10));\n',
  );
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({
      private: true,
      type: "module",
      scripts: {
        "fix:course-workspace-accessibility":
          "node scripts/apply-course-workspace-accessibility-patch.mjs",
        "verify:course-workspace-contract": "node scripts/contract-stub.mjs",
      },
    }, null, 2)}\n`,
  );

  const original = 'export const label = "before";\n';
  const patched = 'export const label = "after";\n';
  writeFileSync(join(root, "src/components/course-workspace.tsx"), original);
  writeFileSync(
    join(root, "patches/s4-001-course-workspace-accessibility.patch"),
    [
      "diff --git a/src/components/course-workspace.tsx b/src/components/course-workspace.tsx",
      "--- a/src/components/course-workspace.tsx",
      "+++ b/src/components/course-workspace.tsx",
      "@@ -1 +1 @@",
      '-export const label = "before";',
      '+export const label = "after";',
      "",
    ].join("\n"),
  );

  const gitInit = run("git", ["init", "-q"], root);
  assert(gitInit.status === 0, `git init failed: ${gitInit.stderr}`);

  return { root, original, patched };
}

function runApplicator(root, contractExit, invocationCwd = root) {
  const node = process.execPath;
  return run(node, [join(root, "scripts/apply-course-workspace-accessibility-patch.mjs")], invocationCwd, {
    CONTRACT_EXIT: String(contractExit),
  });
}

function runNpmAlias(root, contractExit) {
  return run(npmCommand, ["run", "fix:course-workspace-accessibility"], root, {
    CONTRACT_EXIT: String(contractExit),
  });
}

const fixtures = [
  {
    name: "npm alias applies and verifies",
    execute() {
      const fixture = createFixture();
      try {
        const result = runNpmAlias(fixture.root, 0);
        const content = readFileSync(join(fixture.root, "src/components/course-workspace.tsx"), "utf8");
        assert(result.status === 0, `expected exit 0, received ${result.status}: ${result.stderr}`);
        assert(content === fixture.patched, "npm alias did not leave patched content");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
  {
    name: "applies and verifies",
    execute() {
      const fixture = createFixture();
      try {
        const result = runApplicator(fixture.root, 0);
        const content = readFileSync(join(fixture.root, "src/components/course-workspace.tsx"), "utf8");
        assert(result.status === 0, `expected exit 0, received ${result.status}: ${result.stderr}`);
        assert(content === fixture.patched, "successful application did not leave patched content");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
  {
    name: "applies when invoked outside repository cwd",
    execute() {
      const fixture = createFixture();
      const invocationCwd = mkdtempSync(join(tmpdir(), "course-workspace-invocation-"));
      try {
        const result = runApplicator(fixture.root, 0, invocationCwd);
        const content = readFileSync(join(fixture.root, "src/components/course-workspace.tsx"), "utf8");
        assert(result.status === 0, `expected exit 0, received ${result.status}: ${result.stderr}`);
        assert(content === fixture.patched, "external-cwd invocation did not leave patched content");
      } finally {
        rmSync(invocationCwd, { recursive: true, force: true });
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
  {
    name: "already applied stays unchanged",
    execute() {
      const fixture = createFixture();
      try {
        writeFileSync(join(fixture.root, "src/components/course-workspace.tsx"), fixture.patched);
        const result = runApplicator(fixture.root, 0);
        const content = readFileSync(join(fixture.root, "src/components/course-workspace.tsx"), "utf8");
        assert(result.status === 0, `expected exit 0, received ${result.status}: ${result.stderr}`);
        assert(content === fixture.patched, "already-applied state changed the target file");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
  {
    name: "contract failure rolls back new patch",
    execute() {
      const fixture = createFixture();
      try {
        const result = runApplicator(fixture.root, 7);
        const content = readFileSync(join(fixture.root, "src/components/course-workspace.tsx"), "utf8");
        assert(result.status === 7, `expected exit 7, received ${result.status}: ${result.stderr}`);
        assert(content === fixture.original, "contract failure did not restore original content");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
  {
    name: "rollback failure returns generic failure",
    execute() {
      const fixture = createFixture();
      try {
        const componentPath = join(fixture.root, "src/components/course-workspace.tsx");
        writeFileSync(
          join(fixture.root, "scripts/contract-stub.mjs"),
          `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(componentPath)}, 'export const label = "contract-modified";\\n');\nprocess.exit(7);\n`,
        );
        const result = runApplicator(fixture.root, 0);
        const content = readFileSync(componentPath, "utf8");
        assert(result.status === 1, `expected exit 1, received ${result.status}: ${result.stderr}`);
        assert(
          result.stderr.includes("automatic patch rollback also failed"),
          `missing rollback failure diagnostic: ${result.stderr}`,
        );
        assert(
          content === 'export const label = "contract-modified";\n',
          "rollback failure unexpectedly changed contract-modified content",
        );
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
  {
    name: "already applied contract failure preserves file",
    execute() {
      const fixture = createFixture();
      try {
        writeFileSync(join(fixture.root, "src/components/course-workspace.tsx"), fixture.patched);
        const result = runApplicator(fixture.root, 9);
        const content = readFileSync(join(fixture.root, "src/components/course-workspace.tsx"), "utf8");
        assert(result.status === 9, `expected exit 9, received ${result.status}: ${result.stderr}`);
        assert(content === fixture.patched, "already-applied contract failure changed the target file");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
  {
    name: "conflict refuses without changing file",
    execute() {
      const fixture = createFixture();
      try {
        const conflict = 'export const label = "conflict";\n';
        const contractMarker = join(fixture.root, "contract-ran.txt");
        writeFileSync(join(fixture.root, "src/components/course-workspace.tsx"), conflict);
        writeFileSync(
          join(fixture.root, "scripts/contract-stub.mjs"),
          `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(contractMarker)}, "ran");\n`,
        );
        const result = runApplicator(fixture.root, 0);
        const content = readFileSync(join(fixture.root, "src/components/course-workspace.tsx"), "utf8");
        assert(result.status === 1, `expected exit 1, received ${result.status}: ${result.stderr}`);
        assert(content === conflict, "conflict state changed the target file");
        assert(!existsSync(contractMarker), "conflict state unexpectedly ran the contract");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  },
];

for (const fixture of fixtures) fixture.execute();
console.log(`CourseWorkspace accessibility applicator fixtures passed: ${fixtures.length}/${fixtures.length}.`);
