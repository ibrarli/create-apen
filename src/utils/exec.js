import { spawn, spawnSync } from "node:child_process";

const isWin = process.platform === "win32";

/** True when `cmd` can be executed (e.g. "dotnet", "docker"). */
export function hasCommand(cmd) {
  const res = spawnSync(isWin ? "where" : "which", [cmd], { stdio: "ignore" });
  return res.status === 0;
}

export function commandVersion(cmd, args = ["--version"]) {
  const res = spawnSync(cmd, args, { encoding: "utf8", shell: isWin });
  return res.status === 0 ? res.stdout.trim() : null;
}

/** Runs a command, capturing output. Resolves { ok, output }. */
export function run(cmd, args, { cwd, env } = {}) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: isWin });
    child.stdout?.on("data", (d) => (output += d));
    child.stderr?.on("data", (d) => (output += d));
    child.on("error", (err) => resolve({ ok: false, output: String(err) }));
    child.on("close", (code) => resolve({ ok: code === 0, output }));
  });
}

/** Detects the package manager that launched us (npm create / pnpm create / …). */
export function detectPackageManager() {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

/** Command used to run a package.json script with a given package manager. */
export const runScript = (pm, script) => (pm === "npm" ? `npm run ${script}` : `${pm} ${script}`);
