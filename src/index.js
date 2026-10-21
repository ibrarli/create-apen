// Orchestrates the CLI: questions → generation → write → install → git.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as p from "./ui/prompts.js";
import { banner, bold, dim, orange, blue, gradient } from "./ui/theme.js";
import { collectConfig, Cancelled } from "./questions.js";
import { FRONTENDS, BACKENDS, PRESETS, EXTRAS, port, label } from "./catalog.js";
import { Project } from "./utils/project.js";
import { hasCommand, commandVersion, run, detectPackageManager, runScript } from "./utils/exec.js";
import { pascal, snake } from "./utils/naming.js";
import { DOTNET_DEFAULT_MAJOR } from "./versions.js";
import { generateReact } from "./generators/frontend/react.js";
import { generateVue } from "./generators/frontend/vue.js";
import { generateExpress } from "./generators/backend/express.js";
import { generateDotnet } from "./generators/backend/dotnet.js";
import { generateFastapi } from "./generators/backend/fastapi.js";
import { generateDocker } from "./generators/shared/docker.js";
import { generateRoot } from "./generators/shared/root.js";
import { generateReadmes } from "./generators/shared/readme.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const HELP = `
${bold("Usage")}
  npx create-apen ${dim("[project-name] [options]")}

${bold("Options")}
  --preset <name>     ${PRESETS.map((x) => x.value).join(" | ")}
  --type <type>       fullstack | frontend | backend
  --frontend <name>   ${FRONTENDS.map((x) => x.value).join(" | ")}
  --backend <name>    ${BACKENDS.map((x) => x.value).join(" | ")}
  --extras <list>     comma-separated: ${EXTRAS.map((x) => x.value).join(",")}
  --pm <name>         npm | pnpm | yarn | bun
  --no-install        skip installing dependencies
  --no-git            skip git init + first commit
  -y, --yes           accept defaults for every unanswered question
  -v, --version       print version
  -h, --help          show this help

${bold("Examples")}
  npx create-apen my-shop --preset mern
  npx create-apen dashboard --preset next-dotnet --yes
  npx create-apen web --type frontend --frontend vue
`;

export function parseArgs(argv) {
  const flags = { detectedPm: detectPackageManager() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith("-")) throw new Error(`Missing value for ${arg}`);
      return v;
    };
    if (arg === "-h" || arg === "--help") flags.help = true;
    else if (arg === "-v" || arg === "--version") flags.version = true;
    else if (arg === "-y" || arg === "--yes") flags.yes = true;
    else if (arg === "--no-install") flags.install = false;
    else if (arg === "--install") flags.install = true;
    else if (arg === "--no-git") flags.git = false;
    else if (arg === "--preset") flags.preset = value();
    else if (arg === "--type") flags.type = value();
    else if (arg === "--frontend") flags.frontend = value();
    else if (arg === "--backend") flags.backend = value();
    else if (arg === "--pm") flags.pm = value();
    else if (arg === "--extras") flags.extras = value().split(",").filter(Boolean);
    else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}`);
    else flags.name ??= arg;
  }
  if (flags.preset && !PRESETS.some((x) => x.value === flags.preset)) throw new Error(`Unknown preset "${flags.preset}"`);
  if (flags.type && !["fullstack", "frontend", "backend"].includes(flags.type)) throw new Error(`Unknown type "${flags.type}"`);
  if (flags.frontend && !FRONTENDS.some((x) => x.value === flags.frontend)) throw new Error(`Unknown frontend "${flags.frontend}"`);
  if (flags.backend && !BACKENDS.some((x) => x.value === flags.backend)) throw new Error(`Unknown backend "${flags.backend}"`);
  if (flags.pm && !["npm", "pnpm", "yarn", "bun"].includes(flags.pm)) throw new Error(`Unknown package manager "${flags.pm}"`);
  return flags;
}

/** Builds every file of the project in memory. Exported for tests. */
export function buildProject(config) {
  const project = new Project(config.dir);
  const fe = config.frontend;
  const be = config.backend;
  const fullstack = Boolean(fe && be);
  const dotnetVersion = be?.framework === "dotnet" ? commandVersion("dotnet") : null;
  const ctx = {
    project,
    config,
    fullstack,
    packageName: config.packageName,
    title: pascal(config.packageName.split("-").filter(Boolean)).replace(/([a-z0-9])([A-Z])/g, "$1 $2") || "Apen App",
    dbName: snake(config.packageName.split("-").filter(Boolean)) || "app",
    apiPort: be ? port(BACKENDS, be.framework) : 4000,
    frontendPort: fe ? port(FRONTENDS, fe.framework) : 5173,
    dotnetMajor: Number(dotnetVersion?.split(".")[0]) || DOTNET_DEFAULT_MAJOR,
    extras: config.extras,
    stack: [
      fe && label(FRONTENDS, fe.framework).replace(" (App Router)", ""),
      be && label(BACKENDS, be.framework).replace("Node.js + ", "").replace(" Web API (.NET)", "").replace("Python + ", ""),
      be && be.database !== "none" && { mongodb: "MongoDB", postgres: "PostgreSQL", mysql: "MySQL", sqlserver: "SQL Server", sqlite: "SQLite" }[be.database],
      config.extras.includes("docker") && "Docker",
    ].filter(Boolean),
  };

  if (fe) {
    const fctx = { ...ctx, prefix: fullstack ? "frontend/" : "", fe };
    ctx.frontendInfo = fe.framework === "vue" ? generateVue(fctx) : generateReact(fctx);
  }
  if (be) {
    const bctx = { ...ctx, prefix: fullstack ? "backend/" : "", be };
    ctx.backendInfo =
      be.framework === "express" ? generateExpress(bctx) : be.framework === "dotnet" ? generateDotnet(bctx) : generateFastapi(bctx);
  }
  if (config.extras.includes("docker")) ctx.dockerInfo = generateDocker(ctx);
  generateRoot(ctx);
  generateReadmes(ctx);
  return ctx;
}

async function install(ctx, s) {
  const { config } = ctx;
  const failures = [];
  const step = async (title, cmd, args, cwd) => {
    s.start(title);
    const res = await run(cmd, args, { cwd });
    s.stop(res.ok ? title.replace(/^Installing/, "Installed").replace(/^Restoring/, "Restored").replace(/^Creating/, "Created") : `${title} — failed`, res.ok);
    if (!res.ok) failures.push({ title, output: res.output.split("\n").slice(-15).join("\n") });
    return res.ok;
  };
  const root = config.dir;
  const fe = config.frontend;
  const be = config.backend;
  const pm = config.pm;
  const jsDirs = [];
  if (ctx.fullstack) jsDirs.push(["root", root]);
  if (fe) jsDirs.push(["frontend", ctx.fullstack ? path.join(root, "frontend") : root]);
  if (be?.framework === "express") jsDirs.push(["backend", ctx.fullstack ? path.join(root, "backend") : root]);

  if (jsDirs.length) {
    if (!hasCommand(pm)) {
      p.log.warn(`${pm} was not found on PATH — skipping JavaScript dependencies.`);
    } else {
      for (const [name, dir] of jsDirs) await step(`Installing ${name} dependencies with ${pm}`, pm, ["install"], dir);
    }
  }

  const beDir = ctx.fullstack ? path.join(root, "backend") : root;
  if (be?.framework === "dotnet") {
    if (hasCommand("dotnet")) await step("Restoring .NET packages", "dotnet", ["restore", `${ctx.backendInfo.N}.sln`], beDir);
    else p.log.warn(`.NET SDK not found — install .NET ${ctx.dotnetMajor} and run ${bold("dotnet restore")} in the backend.`);
  }
  if (be?.framework === "fastapi") {
    const python = ["python3", "python"].find(hasCommand);
    if (!python) p.log.warn("Python not found — create a virtualenv and run pip install -r requirements.txt.");
    else if (await step("Creating Python virtualenv", python, ["-m", "venv", ".venv"], beDir)) {
      const pip = process.platform === "win32" ? ".venv\\Scripts\\pip" : ".venv/bin/pip";
      await step("Installing Python dependencies", path.join(beDir, pip), ["install", "-r", "requirements.txt"], beDir);
    }
  }
  return failures;
}

async function initGit(dir, s) {
  if (!hasCommand("git")) return p.log.warn("git not found — skipping repository setup.");
  const inside = await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dir });
  if (inside.ok) return p.log.info("Already inside a git repository — skipping git init.");
  s.start("Initialising git repository");
  const steps = [
    ["init", "-b", "main"],
    ["add", "-A"],
    ["commit", "-m", "chore: scaffold project with create-apen"],
  ];
  for (const args of steps) {
    const res = await run("git", args, { cwd: dir });
    if (!res.ok) {
      s.stop(args[0] === "commit" ? "Git repository created (commit skipped — set git user.name/user.email)" : "git init failed", args[0] === "commit");
      return;
    }
  }
  s.stop("Git repository created with an initial commit");
}

export async function main(argv = process.argv.slice(2)) {
  let flags;
  try {
    flags = parseArgs(argv);
  } catch (err) {
    console.error(`\n  ${orange("✖")} ${err.message}\n${HELP}`);
    process.exitCode = 1;
    return;
  }
  if (flags.version) return console.log(version);
  if (flags.help) return console.log(banner(version) + HELP);

  console.log(banner(version));
  if (!flags.yes && !process.stdin.isTTY) {
    console.error(`  ${orange("✖")} No interactive terminal detected. Re-run with ${bold("--yes")} (and flags) to use defaults.\n`);
    process.exitCode = 1;
    return;
  }

  p.intro("create-apen");
  let config;
  try {
    config = await collectConfig(flags);
  } catch (err) {
    if (err instanceof Cancelled) return p.cancel("Setup cancelled — nothing was written.");
    throw err;
  }

  if (fs.existsSync(config.dir) && fs.readdirSync(config.dir).length) {
    p.cancel(`Folder ${config.name} already exists and is not empty.`);
    process.exitCode = 1;
    return;
  }

  const s = p.spinner();
  s.start("Generating project files");
  const ctx = buildProject(config);
  ctx.project.writeToDisk();
  s.stop(`Generated ${ctx.project.files.size} files in ${bold(path.relative(process.cwd(), config.dir) || ".")}`);

  const failures = config.install ? await install(ctx, s) : [];
  for (const f of failures) p.log.error(`${f.title} failed:\n${dim(f.output.trim())}`);
  if (config.git) await initGit(config.dir, s);

  // ── next steps ──────────────────────────────────────────
  const rel = path.relative(process.cwd(), config.dir) || ".";
  const pm = config.pm;
  const next = [`cd ${rel}`];
  if (!config.install) {
    if (ctx.fullstack || config.frontend || config.backend?.framework === "express") next.push(`${pm} install${ctx.fullstack ? "   (root, frontend/ and backend/)" : ""}`);
  }
  const db = config.backend && !["none", "sqlite"].includes(config.backend.database);
  if (db && config.extras.includes("docker")) next.push("docker compose up -d db");
  if (ctx.fullstack) next.push(runScript(pm, "dev"));
  else if (config.frontend || config.backend.framework === "express") next.push(runScript(pm, "dev"));
  else if (config.backend.framework === "dotnet") next.push(`dotnet watch run --project ${ctx.backendInfo.apiDir}`);
  else next.push(".venv/bin/uvicorn app.main:app --reload");

  const urls = [
    config.frontend && `${blue("Frontend")}  http://localhost:${ctx.frontendPort}`,
    config.backend && `${orange("API")}       http://localhost:${ctx.apiPort}/api`,
  ].filter(Boolean);
  p.note([...next.map((l) => `${dim("$")} ${l}`), "", ...urls, "", dim("README.md explains the structure and the request flow.")].join("\n"), "Next steps");
  p.outro(`${gradient("Happy building!")} ${dim("— Apen Apps")}`);
}
