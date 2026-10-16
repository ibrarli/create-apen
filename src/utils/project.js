// In-memory file tree for the project being generated. Files are collected first and
// written to disk at the end, so the README can include the real folder tree.
import fs from "node:fs";
import path from "node:path";
import { transform } from "sucrase";

export class Project {
  constructor(root) {
    this.root = root;
    this.files = new Map();
  }

  /** Adds a file. `rel` is relative to the project root, always with "/" separators. */
  add(rel, content) {
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n";
    this.files.set(rel.replace(/^\.\//, ""), dedent(text));
    return rel;
  }

  /**
   * Adds a TypeScript source file. When `language` is "js" the types are stripped and the
   * extension becomes .js/.jsx; type-only files (`typesOnly`) are skipped entirely.
   */
  code(rel, source, language, { typesOnly = false } = {}) {
    if (language === "ts") return this.add(rel, source);
    if (typesOnly) return null;
    const isJsx = rel.endsWith(".tsx");
    const js = transform(dedent(source), {
      transforms: isJsx ? ["typescript", "jsx"] : ["typescript"],
      jsxRuntime: "preserve",
      disableESTransforms: true,
      keepUnusedImports: false,
    }).code;
    return this.add(rel.replace(/\.tsx$/, ".jsx").replace(/\.ts$/, ".js"), tidy(js));
  }

  has(rel) {
    return this.files.has(rel);
  }

  writeToDisk() {
    for (const [rel, content] of this.files) {
      const abs = path.join(this.root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
  }

  /** Renders a folder tree of the generated files (optionally under `prefix`). */
  tree(prefix = "", { maxDepth = 6 } = {}) {
    const root = {};
    for (const rel of [...this.files.keys()].sort()) {
      if (prefix && !rel.startsWith(prefix)) continue;
      const parts = rel.slice(prefix.length).split("/").filter(Boolean);
      let node = root;
      parts.forEach((p, i) => {
        node[p] ??= i === parts.length - 1 ? null : {};
        if (node[p] !== null) node = node[p];
      });
    }
    const lines = [];
    const walk = (node, indent, depth) => {
      const entries = Object.entries(node).sort(([a, av], [b, bv]) => (av === null) - (bv === null) || a.localeCompare(b));
      entries.forEach(([name, child], i) => {
        const last = i === entries.length - 1;
        lines.push(`${indent}${last ? "└── " : "├── "}${name}${child ? "/" : ""}`);
        if (child && depth < maxDepth) walk(child, indent + (last ? "    " : "│   "), depth + 1);
      });
    };
    walk(root, "", 1);
    return lines.join("\n");
  }
}

/**
 * Removes the common leading indentation from template literals and trims the first newline.
 * The first line's indentation is the template's base. Lines indented less than that come from
 * multi-line interpolations (already-formatted blocks) and are left untouched.
 */
export function dedent(text) {
  const lines = text.replace(/^\n/, "").split("\n");
  const first = lines.find((l) => l.trim());
  const base = first ? first.match(/^ */)[0].length : 0;
  const prefix = " ".repeat(base);
  const out = lines.map((l) => (l.startsWith(prefix) ? l.slice(base) : l)).join("\n").replace(/^(\s*\n)+/, "");
  return out.endsWith("\n") ? out : out + "\n";
}

// Cleans up what sucrase leaves behind after removing types.
function tidy(code) {
  return (
    code
      .replace(/[ \t]+$/gm, "")
      .replace(/(\S)  +=/g, "$1 =")
      .replace(/(\w) +([),;])/g, "$1$2")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+/, "")
      .trimEnd() + "\n"
  );
}
