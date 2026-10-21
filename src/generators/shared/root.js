// Repository-level files: .gitignore, formatting, CI, and the root package.json for full-stack repos.
import { NPM } from "../../versions.js";
import { runScript } from "../../utils/exec.js";

export function generateRoot(ctx) {
  const { project, config } = ctx;
  const fe = config.frontend;
  const be = config.backend;

  project.add(
    ".gitignore",
    [
      "# dependencies",
      "node_modules/",
      ".venv/",
      "",
      "# builds",
      "dist/",
      ".next/",
      "out/",
      "bin/",
      "obj/",
      "__pycache__/",
      "*.pyc",
      "*.tsbuildinfo",
      "next-env.d.ts",
      "",
      "# env & local data",
      ".env",
      ".env.local",
      ".env.*.local",
      "*.db",
      "",
      "# editors & OS",
      ".vs/",
      ".idea/",
      ".DS_Store",
      "*.log",
      "",
    ].join("\n")
  );

  if (config.extras.includes("prettier")) {
    project.add(
      ".editorconfig",
      `
      root = true

      [*]
      charset = utf-8
      end_of_line = lf
      insert_final_newline = true
      indent_style = space
      indent_size = 2
      trim_trailing_whitespace = true

      [*.{cs,py}]
      indent_size = 4

      [*.md]
      trim_trailing_whitespace = false
      `
    );
    project.add(".prettierrc", { semi: true, singleQuote: false, trailingComma: "es5", printWidth: 110 });
    project.add(".prettierignore", "node_modules\ndist\n.next\nbin\nobj\n.venv\n*.lock\npnpm-lock.yaml\npackage-lock.json\n");
  }

  if (config.extras.includes("ci")) project.add(".github/workflows/ci.yml", ciWorkflow(ctx));

  // Root package.json: one command to run the whole stack.
  if (ctx.fullstack) {
    const pm = config.pm;
    const scripts = {
      dev: `concurrently -n frontend,backend -c "#00aeef,#f15a29" "${runScript(pm, "dev:frontend")}" "${runScript(pm, "dev:backend")}"`,
      "dev:frontend": `cd frontend && ${runScript(pm, "dev")}`,
      "dev:backend": devBackend(ctx),
      build: `cd frontend && ${runScript(pm, "build")}`,
    };
    if (be.framework === "dotnet") scripts["build:backend"] = `dotnet build backend/${ctx.backendInfo.N}.sln`;
    if (be.framework === "express" && be.language === "ts") scripts["build:backend"] = `cd backend && ${runScript(pm, "build")}`;
    if (config.extras.includes("docker")) {
      scripts["docker:up"] = "docker compose up --build";
      scripts["docker:down"] = "docker compose down";
      if (ctx.dockerInfo?.database) scripts["db:up"] = "docker compose up -d db";
    }
    if (config.extras.includes("prettier")) scripts.format = "prettier --write .";
    project.add("package.json", {
      name: ctx.packageName,
      version: "0.1.0",
      private: true,
      scripts,
      devDependencies: {
        concurrently: NPM.concurrently,
        ...(config.extras.includes("prettier") && { prettier: NPM.prettier }),
      },
    });
  }
}

export function devBackend(ctx) {
  const be = ctx.config.backend;
  const dir = ctx.fullstack ? "backend" : ".";
  if (be.framework === "express") return `cd ${dir} && ${runScript(ctx.config.pm, "dev")}`;
  if (be.framework === "dotnet") return `dotnet watch run --project ${dir}/${ctx.backendInfo.apiDir}`;
  return `cd ${dir} && .venv/bin/python -m uvicorn app.main:app --reload --port ${ctx.apiPort}`;
}

function ciWorkflow(ctx) {
  const { config } = ctx;
  const fe = config.frontend;
  const be = config.backend;
  const fd = ctx.fullstack ? "frontend" : ".";
  const bd = ctx.fullstack ? "backend" : ".";
  const jobs = [];
  const nodeSetup = (dir) => `
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
        working-directory: ${dir}`;

  if (fe) {
    jobs.push(`
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4${nodeSetup(fd)}
      - run: npm run build
        working-directory: ${fd}`);
  }
  if (be?.framework === "express") {
    jobs.push(`
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4${nodeSetup(bd)}${
        be.language === "ts"
          ? `
      - run: npm run build
        working-directory: ${bd}`
          : `
      - run: node --check ${ctx.backendInfo.entry.replace(/\.ts$/, ".js")}
        working-directory: ${bd}`
      }`);
  }
  if (be?.framework === "dotnet") {
    jobs.push(`
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "${ctx.dotnetMajor}.0.x"
      - run: dotnet build ${ctx.backendInfo.N}.sln -c Release
        working-directory: ${bd}`);
  }
  if (be?.framework === "fastapi") {
    jobs.push(`
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
        working-directory: ${bd}
      - run: python -c "import app.main"
        working-directory: ${bd}`);
  }
  if (config.extras.includes("docker")) {
    jobs.push(`
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build`);
  }
  return `name: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\njobs:${jobs.join("\n")}\n`;
}
