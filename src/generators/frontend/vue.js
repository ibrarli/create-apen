// Vue 3 (Vite) generator — <script setup> SFCs, composables, optional Pinia + Vue Router.
import { layout, styler } from "./structure.js";
import { STYLES, BASE_CSS } from "./styles.js";
import { writeDataLayer, ENV_GUIDE } from "./core.js";
import { NPM } from "../../versions.js";
import { pascal } from "../../utils/naming.js";

export function generateVue(ctx) {
  const { project, prefix, fe } = ctx;
  const ts = fe.language === "ts";
  const L = layout(fe);
  const feature = fe.structure === "feature";
  const pinia = fe.state.includes("pinia");
  const router = fe.router;
  const serviceName = feature ? "usersApi" : "userService";
  const cssRules = [];
  const imp = (role) => L.import(role);
  const lang = ts ? ` lang="ts"` : "";
  const t = (tsCode, jsCode) => (ts ? tsCode : jsCode);

  // Writes an SFC. `script` and `template` are strings; styles depend on the styling mode.
  const sfc = (role, styleKey, build) => {
    const words = styleKey.replace(/([A-Z])/g, " $1").toLowerCase().split(" ");
    const s = styler(fe.styling, words, STYLES[styleKey] ?? {});
    const { script, template } = build(s);
    let style = "";
    if (fe.styling === "modules" && STYLES[styleKey]) style = `\n<style scoped>\n${s.css()}\n</style>\n`;
    if (fe.styling === "css" && STYLES[styleKey]) cssRules.push(s.css());
    const rel = role.includes("/") ? role : L.path(role);
    project.add(prefix + rel, `<script setup${lang}>\n${dedentBlock(script)}</script>\n\n<template>\n${indent(dedentBlock(template))}</template>\n${style}`);
  };
  const mod = (role, code) => project.code(prefix + L.path(role), code, fe.language);

  writeDataLayer(ctx, L, { serviceName, envFlavor: "vite" });

  mod(
    "useUsers",
    `
    import { onMounted, ref } from "vue";
    import { ${serviceName} } from "${imp("usersApi")}";
    import type { User } from "${imp("userTypes")}";

    /** Loads users from the API and exposes reactive state for components. */
    export function useUsers() {
      const users = ref<User[]>([]);
      const isLoading = ref(true);
      const error = ref<Error | null>(null);

      async function refetch() {
        isLoading.value = true;
        error.value = null;
        try {
          users.value = await ${serviceName}.list();
        } catch (err) {
          error.value = err instanceof Error ? err : new Error(String(err));
        } finally {
          isLoading.value = false;
        }
      }

      onMounted(refetch);

      return { users, isLoading, error, refetch };
    }
    `
  );

  if (pinia) {
    mod(
      "usersStore",
      `
      import { defineStore } from "pinia";
      import { ref } from "vue";

      export const useUsersStore = defineStore("users", () => {
        const selectedUserId = ref<string | null>(null);

        function selectUser(id: string | null) {
          selectedUserId.value = id;
        }

        return { selectedUserId, selectUser };
      });
      `
    );
  }

  sfc("button", "button", (s) => ({
    script: t(
      `withDefaults(defineProps<{ type?: "button" | "submit" | "reset"; disabled?: boolean }>(), {
        type: "button",
        disabled: false,
      });
      `,
      `defineProps({
        type: { type: String, default: "button" },
        disabled: { type: Boolean, default: false },
      });
      `
    ),
    template: `
      <button :type="type" :disabled="disabled" ${s.vattr("root")}>
        <slot />
      </button>
      `,
  }));

  sfc("header", "header", (s) => ({
    script: `import { env } from "${imp("env")}";\n`,
    template: `
      <header ${s.vattr("root")}>
        <div ${s.vattr("inner")}>
          <span ${s.vattr("logo")}>{{ env.appName }}</span>
          <span ${s.vattr("tagline")}>Scaffolded with create-apen</span>
        </div>
      </header>
      `,
  }));

  sfc("mainLayout", "mainLayout", (s) => ({
    script: `import ${pascal(["app", "header"])} from "${imp("header")}";\n`,
    template: `
      <div ${s.vattr("root")}>
        <AppHeader />
        <main ${s.vattr("main")}>
          <slot />
        </main>
      </div>
      `,
  }));

  sfc("userCard", "userCard", (s) => {
    const cls = (k) => JSON.stringify(s.vattr(k).slice(7, -1)).replace(/"/g, "'");
    return {
      script: t(
        `import type { User } from "${imp("userTypes")}";

        defineProps<{ user: User; selected?: boolean }>();
        defineEmits<{ select: [id: string] }>();
        `,
        `defineProps({
          user: { type: Object, required: true },
          selected: { type: Boolean, default: false },
        });
        defineEmits(["select"]);
        `
      ),
      template: `
      <button type="button" :class="[${cls("root")}, selected && ${cls("selected")}]" @click="$emit('select', user.id)">
        <span ${s.vattr("name")}>{{ user.name }}</span>
        <span ${s.vattr("email")}>{{ user.email }}</span>
      </button>
      `,
    };
  });

  sfc("userList", "userList", (s) => ({
    script: `
      ${pinia ? "" : `import { ref } from "vue";\n`}import AppButton from "${imp("button")}";
      import UserCard from "${imp("userCard")}";
      import { useUsers } from "${imp("useUsers")}";
      ${pinia ? `import { useUsersStore } from "${imp("usersStore")}";\n` : ""}
      const { users, isLoading, error, refetch } = useUsers();
      ${
        pinia
          ? "const store = useUsersStore();"
          : t(
              `const selectedUserId = ref<string | null>(null);

      function selectUser(id: string) {
        selectedUserId.value = id;
      }`,
              `const selectedUserId = ref(null);

      function selectUser(id) {
        selectedUserId.value = id;
      }`
            )
      }
      `,
    template: `
      <section ${s.vattr("root")}>
        <div ${s.vattr("toolbar")}>
          <h2 ${s.vattr("title")}>Users</h2>
          <AppButton :disabled="isLoading" @click="refetch">{{ isLoading ? "Loading…" : "Refresh" }}</AppButton>
        </div>
        <p v-if="error" ${s.vattr("error")}>Could not reach the API: {{ error.message }}. Is the backend running?</p>
        <p v-else-if="users.length === 0 && !isLoading" ${s.vattr("empty")}>
          No users yet — create one with <code>POST /api/users</code>.
        </p>
        <div v-else ${s.vattr("grid")}>
          <UserCard
            v-for="user in users"
            :key="user.id"
            :user="user"
            :selected="user.id === ${pinia ? "store.selectedUserId" : "selectedUserId"}"
            @select="${pinia ? "store.selectUser" : "selectUser"}"
          />
        </div>
      </section>
      `,
  }));

  sfc("homePage", "homePage", (s) => ({
    script: `
      ${feature ? `import { UserList } from "${imp("featureIndex")}";` : `import UserList from "${imp("userList")}";`}
      import { env } from "${imp("env")}";

      const stack = ${JSON.stringify(ctx.stack).replace(/","/g, "\", \"")};
      `,
    template: `
      <section ${s.vattr("hero")}>
        <p ${s.vattr("eyebrow")}>Apen Apps starter</p>
        <h1 ${s.vattr("title")}>{{ env.appName }}</h1>
        <p ${s.vattr("lead")}>
          Your project is ready. The list below is loaded through the component → composable → service → API client
          flow described in the README.
        </p>
        <div ${s.vattr("chips")}>
          <span v-for="item in stack" :key="item" ${s.vattr("chip")}>{{ item }}</span>
        </div>
      </section>
      <UserList />
      `,
  }));

  if (feature) {
    const rel = (role) => `./${L.dir(role).replace(/^features\/users\//, "")}/${L.base(role)}`;
    project.code(
      prefix + L.path("featureIndex"),
      `
      // Public API of the users feature. Code outside the feature imports from here only.
      export { default as UserList } from "${rel("userList")}.vue";
      export { default as UserCard } from "${rel("userCard")}.vue";
      export { useUsers } from "${rel("useUsers")}";
      export { ${serviceName} } from "${rel("usersApi")}";
      export type { User, CreateUserInput } from "${rel("userTypes")}";
      `,
      fe.language
    );
  }

  if (router) {
    sfc("notFoundPage", "notFoundPage", (s) => ({
      script: `import { RouterLink } from "vue-router";\n`,
      template: `
        <div ${s.vattr("root")}>
          <p ${s.vattr("code")}>404</p>
          <p ${s.vattr("text")}>This page does not exist.</p>
          <RouterLink to="/">Go home</RouterLink>
        </div>
        `,
    }));

    project.code(
      prefix + "src/router/index.ts",
      `
      import { createRouter, createWebHistory } from "vue-router";
      import HomeView from "${imp("homePage")}";

      export const router = createRouter({
        history: createWebHistory(import.meta.env.BASE_URL),
        routes: [
          { path: "/", name: "home", component: HomeView },
          // Lazy-loaded: only fetched when the route is visited.
          { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("${imp("notFoundPage")}") },
        ],
      });
      `,
      fe.language
    );
  }

  sfc("src/App.vue", "app", () => ({
    script: router
      ? `import { RouterView } from "vue-router";\nimport MainLayout from "${imp("mainLayout")}";\n`
      : `import MainLayout from "${imp("mainLayout")}";\nimport HomeView from "${imp("homePage")}";\n`,
    template: router ? `  <MainLayout>\n    <RouterView />\n  </MainLayout>\n` : `  <MainLayout>\n    <HomeView />\n  </MainLayout>\n`,
  }));

  project.code(
    prefix + "src/main.ts",
    `
    import { createApp } from "vue";
    ${pinia ? `import { createPinia } from "pinia";` : ""}
    import App from "./App.vue";
    ${router ? `import { router } from "./router";` : ""}
    import "./styles/globals.css";

    const app = createApp(App);
    ${pinia ? "app.use(createPinia());" : ""}
    ${router ? "app.use(router);" : ""}
    app.mount("#app");
    `,
    fe.language
  );

  project.add(
    prefix + "src/styles/globals.css",
    fe.styling === "tailwind"
      ? `@import "tailwindcss";\n\n@theme {\n  --color-brand-blue: #00aeef;\n  --color-brand-orange: #f15a29;\n  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;\n}\n`
      : `${BASE_CSS}\n${cssRules.length ? `\n/* Component styles (BEM: block__element) */\n${cssRules.join("\n\n")}\n` : ""}`
  );

  project.add(
    prefix + "index.html",
    `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${ctx.title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div id="app"></div>
        <script type="module" src="/src/main.${ts ? "ts" : "js"}"></script>
      </body>
    </html>
    `
  );
  if (ts) project.add(prefix + "src/env.d.ts", `/// <reference types="vite/client" />\n`);
  project.add(prefix + "public/.gitkeep", "");

  // ── config ──────────────────────────────────────────────
  const tailwind = fe.styling === "tailwind";
  const pick = (names) => Object.fromEntries(names.filter(Boolean).map((n) => [n, NPM[n]]));
  const scripts = {
    dev: "vite",
    build: ts ? "vue-tsc --noEmit && vite build" : "vite build",
    preview: "vite preview",
    ...(ts && { typecheck: "vue-tsc --noEmit" }),
    ...(ctx.extras.includes("prettier") && { format: "prettier --write ." }),
  };
  project.add(prefix + "package.json", {
    name: ctx.fullstack ? `${ctx.packageName}-frontend` : ctx.packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts,
    dependencies: pick(["vue", router && "vue-router", pinia && "pinia"]),
    devDependencies: pick([
      "vite",
      "@vitejs/plugin-vue",
      tailwind && "tailwindcss",
      tailwind && "@tailwindcss/vite",
      ts && "typescript",
      ts && "vue-tsc",
      ts && "@vue/tsconfig",
      "@types/node",
      ctx.extras.includes("prettier") && "prettier",
    ]),
  });

  project.code(
    prefix + "vite.config.ts",
    `
    import { fileURLToPath, URL } from "node:url";
    import { defineConfig } from "vite";
    import vue from "@vitejs/plugin-vue";
    ${tailwind ? `import tailwindcss from "@tailwindcss/vite";` : ""}

    export default defineConfig({
      plugins: [vue()${tailwind ? ", tailwindcss()" : ""}],
      resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      },
      server: {
        port: 5173,
        // In development, /api/* is forwarded to the backend — no CORS setup needed in the browser.
        proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:${ctx.apiPort}", changeOrigin: true } },
      },
    });
    `,
    fe.language
  );

  project.add(
    prefix + (ts ? "tsconfig.json" : "jsconfig.json"),
    ts
      ? {
          extends: "@vue/tsconfig/tsconfig.dom.json",
          compilerOptions: { types: ["vite/client"], paths: { "@/*": ["./src/*"] }, skipLibCheck: true },
          include: ["src/**/*.ts", "src/**/*.vue"],
        }
      : { compilerOptions: { module: "ESNext", moduleResolution: "bundler", paths: { "@/*": ["./src/*"] } }, include: ["src"] }
  );

  if (ctx.extras.includes("env")) {
    project.add(prefix + ".env.example", ENV_GUIDE(ctx, "vite"));
    project.add(prefix + ".env", ENV_GUIDE(ctx, "vite"));
  }

  const where = (role) => `src/${L.dir(role) ? L.dir(role) + "/" : ""}`;
  const folders =
    fe.structure === "feature"
      ? [
          ["src/features/users/", "The *users* feature: `components/`, `composables/`, `api/`, `types/`" + (pinia ? ", `stores/`" : "") + " and a public `index`."],
          [where("button"), "Reusable UI primitives shared by every feature."],
          [where("header"), "App shell pieces (header, layout)."],
          [where("apiClient"), "The `fetch` wrapper (`apiClient`)."],
          [where("env"), "Typed access to environment variables."],
          [where("homePage"), "Route-level views."],
        ]
      : [
          [where("button"), fe.structure === "atomic" ? "**Atoms** (Button)." : "Generic UI primitives."],
          [where("userCard"), fe.structure === "atomic" ? "**Molecules** (UserCard)." : "Domain components for users."],
          [where("userList"), fe.structure === "atomic" ? "**Organisms** (UserList, AppHeader)." : "Domain components."],
          [where("mainLayout"), fe.structure === "atomic" ? "**Templates** (MainLayout)." : "Layout components."],
          [where("useUsers"), "Composables — reusable reactive logic."],
          [where("usersApi"), "API services — one module per backend resource."],
          [where("apiClient"), "The `fetch` wrapper (`apiClient`)."],
          [where("env"), "Typed access to environment variables."],
          [where("homePage"), "Route-level views."],
          ...(pinia ? [[where("usersStore"), "Pinia stores (global client state)."]] : []),
        ];
  if (router) folders.push(["src/router/", "Vue Router routes."]);
  folders.push(["src/styles/", "Global stylesheet."]);
  const unique = [...new Map(folders.map((f) => [f[0], f])).values()];
  const js = (p) => (ts ? p : p.replace(/\.ts$/, ".js"));

  return {
    folders: unique,
    flowFiles: {
      component: L.path("userList"),
      hook: js(L.path("useUsers")),
      service: js(L.path("usersApi")),
      client: js(L.path("apiClient")),
    },
  };
}

const indent = (text) => text.replace(/^(?=.)/gm, "  ");

function dedentBlock(text) {
  // The first line may start right after the backtick, so it is trimmed on its own.
  const [first, ...rest] = text.replace(/^\n/, "").split("\n");
  const indents = rest.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  const out = [first.trimStart(), ...rest.map((l) => l.slice(min))]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  return out ? out + "\n" : "";
}
