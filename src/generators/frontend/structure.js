// Where every generated frontend file lives, per folder structure.
// Each role → { dir, words, kind }. Generators never hard-code paths; they ask for a role,
// so the same templates produce feature-based, layer-based or atomic layouts.
import { fileName, kebab } from "../../utils/naming.js";

const ROLES = {
  feature: {
    button: ["shared/components/ui", ["button"], "component"],
    header: ["shared/components/layout", ["app", "header"], "component"],
    mainLayout: ["shared/components/layout", ["main", "layout"], "component"],
    userCard: ["features/users/components", ["user", "card"], "component"],
    userList: ["features/users/components", ["user", "list"], "component"],
    useUsers: ["features/users/hooks", ["use", "users"], "module"],
    usersApi: ["features/users/api", ["users", "api"], "module"],
    userTypes: ["features/users/types", ["user"], "module"],
    usersStore: ["features/users/store", ["use", "users", "store"], "module"],
    usersSlice: ["features/users/store", ["users", "slice"], "module"],
    featureIndex: ["features/users", ["index"], "module"],
    reduxStore: ["app/store", ["index"], "module"],
    apiClient: ["shared/lib", ["api", "client"], "module"],
    utils: ["shared/lib", ["utils"], "module"],
    env: ["shared/config", ["env"], "module"],
    homePage: ["pages", ["home", "page"], "component"],
    notFoundPage: ["pages", ["not", "found", "page"], "component"],
    app: ["app", ["app"], "component"],
    router: ["app", ["router"], "jsx-module"],
    providers: ["app", ["providers"], "component"],
  },
  layer: {
    button: ["components/ui", ["button"], "component"],
    header: ["components/layout", ["app", "header"], "component"],
    mainLayout: ["components/layout", ["main", "layout"], "component"],
    userCard: ["components/users", ["user", "card"], "component"],
    userList: ["components/users", ["user", "list"], "component"],
    useUsers: ["hooks", ["use", "users"], "module"],
    usersApi: ["services", ["user", "service"], "module"],
    userTypes: ["types", ["user"], "module"],
    usersStore: ["store", ["use", "users", "store"], "module"],
    usersSlice: ["store", ["users", "slice"], "module"],
    reduxStore: ["store", ["index"], "module"],
    apiClient: ["lib", ["api", "client"], "module"],
    utils: ["lib", ["utils"], "module"],
    env: ["config", ["env"], "module"],
    homePage: ["pages", ["home", "page"], "component"],
    notFoundPage: ["pages", ["not", "found", "page"], "component"],
    app: ["", ["app"], "component"],
    router: ["", ["router"], "jsx-module"],
    providers: ["", ["providers"], "component"],
  },
  atomic: {
    button: ["components/atoms", ["button"], "component"],
    userCard: ["components/molecules", ["user", "card"], "component"],
    header: ["components/organisms", ["app", "header"], "component"],
    userList: ["components/organisms", ["user", "list"], "component"],
    mainLayout: ["components/templates", ["main", "layout"], "component"],
    homePage: ["components/pages", ["home", "page"], "component"],
    notFoundPage: ["components/pages", ["not", "found", "page"], "component"],
    useUsers: ["hooks", ["use", "users"], "module"],
    usersApi: ["services", ["user", "service"], "module"],
    userTypes: ["types", ["user"], "module"],
    usersStore: ["store", ["use", "users", "store"], "module"],
    usersSlice: ["store", ["users", "slice"], "module"],
    reduxStore: ["store", ["index"], "module"],
    apiClient: ["lib", ["api", "client"], "module"],
    utils: ["lib", ["utils"], "module"],
    env: ["config", ["env"], "module"],
    app: ["", ["app"], "component"],
    router: ["", ["router"], "jsx-module"],
    providers: ["", ["providers"], "component"],
  },
};

// Vue naming: composables instead of hooks, Pinia stores, views instead of pages.
const VUE_DIRS = [
  [/(^|\/)hooks$/, "$1composables"],
  [/(^|\/)store$/, "$1stores"],
  [/^pages$/, "views"],
  [/^components\/pages$/, "views"],
];

/**
 * Resolves roles into concrete paths for the chosen framework/structure/naming.
 * Returns { path(role) → "src/…/File.tsx", import(role) → "@/…/File", name(role) → "File" }.
 */
export function layout({ framework, structure, naming, language }) {
  const ts = language === "ts";
  const roles = ROLES[structure];

  const resolve = (role) => {
    let [dir, words, kind] = roles[role];
    if (framework === "vue") for (const [re, to] of VUE_DIRS) dir = dir.replace(re, to);
    if (framework === "vue" && role === "homePage") words = ["home", "view"];
    if (framework === "vue" && role === "notFoundPage") words = ["not", "found", "view"];
    const base = words[0] === "index" ? "index" : fileName(words, kind === "jsx-module" ? "module" : kind, naming);
    let ext;
    if (kind === "component" || kind === "jsx-module") ext = framework === "vue" ? ".vue" : ts ? ".tsx" : ".jsx";
    else ext = ts ? ".ts" : ".js";
    // JSX-free "component" roles (router config for Vue) are plain modules.
    if (framework === "vue" && role === "router") ext = ts ? ".ts" : ".js";
    return { dir, base, ext };
  };

  return {
    /** Path relative to the app root, e.g. "src/features/users/components/UserCard.tsx". */
    path(role) {
      const { dir, base, ext } = resolve(role);
      // Always hand back TS extensions for the Project.code() pipeline; it rewrites to JS.
      const tsExt = ext === ".jsx" ? ".tsx" : ext === ".js" ? ".ts" : ext;
      return ["src", dir, base + tsExt].filter(Boolean).join("/");
    },
    /** Import specifier using the "@/" alias, without extension (except .vue). */
    import(role) {
      const { dir, base, ext } = resolve(role);
      const spec = ["@", dir, base].filter(Boolean).join("/");
      return ext === ".vue" ? spec + ".vue" : spec.replace(/\/index$/, "");
    },
    base: (role) => resolve(role).base,
    dir: (role) => resolve(role).dir,
    /** Folder description used by the README. */
    roles,
  };
}

/**
 * Styling helper for one component.
 *  - tailwind → utility classes
 *  - css      → BEM classes collected into the global stylesheet
 *  - modules  → CSS Module (React) / scoped <style> (Vue)
 */
export function styler(styling, words, styles) {
  const block = kebab(words);
  const cls = (key) => (styling === "tailwind" ? styles[key].tw : styling === "css" ? `${block}__${key}` : key);
  return {
    styling,
    /** JSX attribute: className="…" or className={styles.key} */
    attr: (key) => (styling === "modules" ? `className={styles.${key}}` : `className="${cls(key)}"`),
    /** JS expression for the class (for cn()). */
    expr: (key) => (styling === "modules" ? `styles.${key}` : JSON.stringify(cls(key))),
    /** Vue attribute */
    vattr: (key) => `class="${cls(key)}"`,
    /** CSS rules for css/modules modes. */
    css() {
      if (styling === "tailwind") return "";
      return Object.entries(styles)
        .map(([key, s]) => `.${styling === "css" ? `${block}__${key}` : key} {\n${s.css.trim().split("\n").map((l) => `  ${l.trim()}`).join("\n")}\n}`)
        .join("\n\n");
    },
  };
}
