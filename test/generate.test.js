import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProject, parseArgs } from "../src/index.js";
import { DATABASES, BACKEND_ARCHITECTURES } from "../src/catalog.js";

const EXTRAS = ["docker", "prettier", "ci", "env"];

function config({ frontend = null, backend = null }) {
  return { name: "demo-app", packageName: "demo-app", dir: "/tmp/demo-app", frontend, backend, extras: EXTRAS, pm: "npm" };
}

function check(ctx, label) {
  for (const [file, content] of ctx.project.files) {
    const where = `${label} → ${file}`;
    assert.ok(!/(?<!\| )undefined/.test(content), `"undefined" leaked into ${where}`);
    assert.ok(!content.includes("__STYLES__"), `style placeholder leaked into ${where}`);
    assert.ok(!/\[object Object\]/.test(content), `object leaked into ${where}`);
    if (file.endsWith(".json")) assert.doesNotThrow(() => JSON.parse(content), `invalid JSON in ${where}`);
    if (file.endsWith(".py") && content.trim()) assert.match(content, /^\S/, `indented first line in ${where}`);
    if (/\.(ts|tsx|js|jsx|cs)$/.test(file)) assert.match(content, /^\S/, `indented first line in ${where}`);
  }
}

const frontends = [];
for (const framework of ["react", "next", "vue"])
  for (const language of ["ts", "js"])
    for (const styling of ["tailwind", "modules", "css"])
      for (const structure of ["feature", "layer", "atomic"])
        for (const naming of ["pascal", "kebab"]) {
          const state = framework === "vue" ? ["pinia"] : ["query", "zustand", "redux"];
          frontends.push({ framework, language, styling, structure, naming, state, router: true });
        }

const backends = [];
for (const framework of ["express", "dotnet", "fastapi"])
  for (const { value: database } of DATABASES[framework])
    for (const { value: architecture } of BACKEND_ARCHITECTURES[framework])
      for (const language of framework === "express" ? ["ts", "js"] : [null]) backends.push({ framework, database, architecture, language });

test("every frontend combination generates cleanly", () => {
  for (const fe of frontends) check(buildProject(config({ frontend: fe })), JSON.stringify(fe));
});

test("every backend combination generates cleanly", () => {
  for (const be of backends) check(buildProject(config({ backend: be })), JSON.stringify(be));
});

test("full-stack projects get root scripts, compose and per-app READMEs", () => {
  const ctx = buildProject(config({ frontend: frontends[0], backend: backends[0] }));
  for (const f of ["package.json", "docker-compose.yml", "README.md", "frontend/README.md", "backend/README.md", ".github/workflows/ci.yml"])
    assert.ok(ctx.project.has(f), `missing ${f}`);
  assert.match(JSON.parse(ctx.project.files.get("package.json")).scripts.dev, /concurrently/);
});

test("minimal state options still produce a working React app", () => {
  const fe = { ...frontends[0], state: [], router: false };
  check(buildProject(config({ frontend: fe })), "react minimal");
});

test("parseArgs reads flags", () => {
  const flags = parseArgs(["shop", "--preset", "mern", "-y", "--no-install", "--extras", "docker,ci"]);
  assert.equal(flags.name, "shop");
  assert.equal(flags.preset, "mern");
  assert.equal(flags.yes, true);
  assert.equal(flags.install, false);
  assert.deepEqual(flags.extras, ["docker", "ci"]);
  assert.throws(() => parseArgs(["--preset", "nope"]));
});
