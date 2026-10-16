// Turns word lists into names that follow the chosen convention.
const cap = (w) => w[0].toUpperCase() + w.slice(1);

export const pascal = (words) => words.map(cap).join("");
export const camel = (words) => words[0] + words.slice(1).map(cap).join("");
export const kebab = (words) => words.join("-");
export const snake = (words) => words.join("_");

/**
 * File base name for a given kind of file.
 *  - "pascal" convention → components PascalCase, everything else camelCase
 *  - "kebab"  convention → everything kebab-case
 */
export function fileName(words, kind, convention) {
  if (convention === "kebab") return kebab(words);
  return kind === "component" ? pascal(words) : camel(words);
}

/** Valid npm package name from a free-form project name. */
export function toPackageName(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^[._]/, "")
      .replace(/[^a-z0-9-~]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "apen-app"
  );
}

/** .NET-style PascalCase identifier, e.g. "my-shop api" → "MyShopApi". */
export function toDotnetName(name) {
  const id = pascal(name.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w.toLowerCase()));
  return /^[0-9]/.test(id) ? `App${id}` : id || "ApenApp";
}
