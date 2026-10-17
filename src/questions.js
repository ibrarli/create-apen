import fs from "node:fs";
import path from "node:path";
import * as p from "./ui/prompts.js";
import {
  PROJECT_TYPES,
  PRESETS,
  FRONTENDS,
  BACKENDS,
  DATABASES,
  LANGUAGES,
  STYLING,
  FRONTEND_STRUCTURES,
  NAMING,
  REACT_STATE,
  BACKEND_ARCHITECTURES,
  EXTRAS,
  PACKAGE_MANAGERS,
} from "./catalog.js";
import { toPackageName } from "./utils/naming.js";

class Cancelled extends Error {}
export { Cancelled };

// Unwraps a prompt result, aborting the whole flow on Ctrl+C / Esc.
async function ask(promise) {
  const value = await promise;
  if (p.isCancel(value)) throw new Cancelled();
  return value;
}

const pick = (list, value) => (list.some((x) => x.value === value) ? value : list[0].value);

/**
 * Builds the full project config. With `yes`, every unanswered question takes its default.
 * `flags` can pre-answer questions (name, preset, pm, install, git).
 */
export async function collectConfig(flags) {
  const interactive = !flags.yes;
  const q = {
    text: (opts) => (interactive ? ask(p.text(opts)) : opts.defaultValue),
    select: (opts) => (interactive ? ask(p.select(opts)) : opts.initialValue ?? opts.options[0].value),
    multiselect: (opts) => (interactive ? ask(p.multiselect(opts)) : opts.initialValues ?? []),
    confirm: (opts) => (interactive ? ask(p.confirm(opts)) : opts.initialValue ?? true),
  };

  // ── Project ─────────────────────────────────────────────
  const name =
    flags.name ??
    (await q.text({
      message: "Project name",
      placeholder: "my-apen-app",
      defaultValue: "my-apen-app",
      validate: (v) => {
        const dir = path.resolve(v || "my-apen-app");
        if (fs.existsSync(dir) && fs.readdirSync(dir).length) return `Folder "${v}" already exists and is not empty.`;
      },
    }));

  const presetFlag = flags.preset && PRESETS.find((x) => x.value === flags.preset);
  const type =
    flags.type ??
    (presetFlag && presetFlag.value !== "custom"
      ? "fullstack"
      : await q.select({ message: "What are you building?", options: PROJECT_TYPES, initialValue: "fullstack" }));

  let preset = { value: "custom" };
  if (type === "fullstack") {
    const chosen = presetFlag?.value ?? (await q.select({ message: "Pick a stack", options: PRESETS, initialValue: "mern" }));
    preset = PRESETS.find((x) => x.value === chosen);
  }

  const config = {
    name,
    packageName: toPackageName(path.basename(name)),
    dir: path.resolve(name),
    type,
    preset: preset.value,
    frontend: null,
    backend: null,
    extras: [],
    pm: flags.pm,
    install: flags.install,
    git: flags.git,
  };

  // ── Frontend ────────────────────────────────────────────
  if (type !== "backend") {
    const framework =
      preset.frontend ??
      flags.frontend ??
      (await q.select({ message: "Frontend framework", options: FRONTENDS, initialValue: "react" }));

    const language = await q.select({ message: "Frontend language", options: LANGUAGES, initialValue: "ts" });
    const styling = await q.select({ message: "Styling", options: STYLING, initialValue: "tailwind" });

    const state =
      framework === "vue"
        ? (await q.confirm({ message: "Add Pinia for state management?", initialValue: true }))
          ? ["pinia"]
          : []
        : await q.multiselect({
            message: "State & data fetching",
            options: REACT_STATE,
            initialValues: ["query", "zustand"],
          });

    const router =
      framework === "next"
        ? true
        : await q.confirm({ message: framework === "vue" ? "Add Vue Router?" : "Add React Router?", initialValue: true });

    const structure = await q.select({
      message: "How do you organise frontend files?",
      options: FRONTEND_STRUCTURES,
      initialValue: "feature",
    });
    const naming = await q.select({ message: "File naming convention", options: NAMING, initialValue: "pascal" });

    config.frontend = { framework, language, styling, state, router, structure, naming };
  }

  // ── Backend ─────────────────────────────────────────────
  if (type !== "frontend") {
    const framework =
      preset.backend ??
      flags.backend ??
      (await q.select({ message: "Backend framework", options: BACKENDS, initialValue: "express" }));

    const language =
      framework === "express" ? await q.select({ message: "Backend language", options: LANGUAGES, initialValue: "ts" }) : null;

    const dbOptions = DATABASES[framework];
    const database = preset.database
      ? pick(dbOptions, preset.database)
      : await q.select({ message: "Database", options: dbOptions, initialValue: dbOptions[0].value });

    const architecture = await q.select({
      message: "How do you organise backend code?",
      options: BACKEND_ARCHITECTURES[framework],
      initialValue: BACKEND_ARCHITECTURES[framework][0].value,
    });

    config.backend = { framework, language, database, architecture };
  }

  // ── Extras & tooling ────────────────────────────────────
  config.extras = flags.extras ?? (await q.multiselect({
    message: "Extras",
    options: EXTRAS,
    initialValues: EXTRAS.map((e) => e.value),
  }));

  const usesNode = config.frontend || config.backend?.framework === "express" || type === "fullstack";
  if (usesNode && !config.pm) {
    config.pm = await q.select({
      message: "Package manager",
      options: PACKAGE_MANAGERS.map((value) => ({ value, label: value })),
      initialValue: flags.detectedPm,
    });
  }
  config.pm ??= flags.detectedPm;

  config.install ??= await q.confirm({ message: "Install dependencies now?", initialValue: true });
  config.git ??= await q.confirm({ message: "Initialise a git repository?", initialValue: true });

  return config;
}
