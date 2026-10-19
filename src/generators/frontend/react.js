// React (Vite) and Next.js (App Router) generator.
import { layout, styler } from "./structure.js";
import { STYLES, BASE_CSS } from "./styles.js";
import { NPM } from "../../versions.js";
import { writeDataLayer, ENV_GUIDE } from "./core.js";

export function generateReact(ctx) {
  const { project, prefix, fe } = ctx;
  const next = fe.framework === "next";
  const ts = fe.language === "ts";
  const L = layout(fe);
  const feature = fe.structure === "feature";
  const useQuery = fe.state.includes("query");
  const useZustand = fe.state.includes("zustand");
  const useRedux = fe.state.includes("redux");
  const hasProviders = useQuery || useRedux;
  const router = !next && fe.router;
  const cssRules = [];
  const serviceName = feature ? "usersApi" : "userService";
  const globalCssPath = next ? "src/app/globals.css" : "src/styles/globals.css";

  // Writes a component, wiring its styles for the chosen styling mode.
  const component = (rel, styleKey, build, { client = false } = {}) => {
    const words = styleKey.replace(/([A-Z])/g, " $1").toLowerCase().split(" ");
    const s = styler(fe.styling, words, STYLES[styleKey] ?? {});
    let code = build(s);
    const fileBase = rel.split("/").pop().replace(/\.tsx$/, "");
    if (fe.styling === "modules" && STYLES[styleKey]) {
      code = code.replace("__STYLES__", `import styles from "./${fileBase}.module.css";`);
      project.add(`${prefix}${rel.replace(/[^/]+$/, `${fileBase}.module.css`)}`, s.css() + "\n");
    } else {
      code = code.replace(/^[ \t]*__STYLES__\n/m, "");
      if (fe.styling === "css" && STYLES[styleKey]) cssRules.push(s.css());
    }
    if (client && next) code = `"use client";\n\n${code}`;
    project.code(prefix + rel, code, fe.language);
  };
  const mod = (role, code, opts) => project.code(prefix + L.path(role), code, fe.language, opts);
  const imp = (role) => L.import(role);
  // Pages import a feature through its public index; everything else imports files directly.
  const pub = (role) => (feature ? imp("featureIndex") : imp(role));

  // ── lib / config / data layer ───────────────────────────
  mod(
    "utils",
    `
    /** Joins class names, skipping falsy values. */
    export function cn(...classes: Array<string | false | null | undefined>) {
      return classes.filter(Boolean).join(" ");
    }
    `
  );

  writeDataLayer(ctx, L, { serviceName, envFlavor: next ? "next" : "vite" });

  mod(
    "useUsers",
    useQuery
      ? `
    import { useQuery } from "@tanstack/react-query";
    import { ${serviceName} } from "${imp("usersApi")}";

    export function useUsers() {
      const query = useQuery({ queryKey: ["users"], queryFn: ${serviceName}.list });
      return { users: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch };
    }
    `
      : `
    import { useCallback, useEffect, useState } from "react";
    import { ${serviceName} } from "${imp("usersApi")}";
    import type { User } from "${imp("userTypes")}";

    export function useUsers() {
      const [users, setUsers] = useState<User[]>([]);
      const [isLoading, setIsLoading] = useState(true);
      const [error, setError] = useState<Error | null>(null);

      const refetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
          setUsers(await ${serviceName}.list());
        } catch (err) {
          setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsLoading(false);
        }
      }, []);

      useEffect(() => {
        void refetch();
      }, [refetch]);

      return { users, isLoading, error, refetch };
    }
    `
  );
  // Hooks are client-only; the directive lets Server Components import the feature's index safely.
  if (next) {
    const hookFile = [...project.files.keys()].find((f) => f.startsWith(prefix + L.path("useUsers").replace(/\.ts$/, "")));
    project.files.set(hookFile, `"use client";\n\n${project.files.get(hookFile)}`);
  }

  if (useZustand) {
    mod(
      "usersStore",
      `
      import { create } from "zustand";

      interface UsersState {
        selectedUserId: string | null;
        selectUser: (id: string | null) => void;
      }

      export const useUsersStore = create<UsersState>()((set) => ({
        selectedUserId: null,
        selectUser: (id) => set({ selectedUserId: id }),
      }));
      `
    );
  }

  if (useRedux) {
    mod(
      "usersSlice",
      `
      import { createSlice } from "@reduxjs/toolkit";
      import type { PayloadAction } from "@reduxjs/toolkit";

      interface UsersState {
        selectedUserId: string | null;
      }

      const initialState: UsersState = { selectedUserId: null };

      export const usersSlice = createSlice({
        name: "users",
        initialState,
        reducers: {
          selectUser(state, action: PayloadAction<string | null>) {
            state.selectedUserId = action.payload;
          },
        },
      });

      export const { selectUser } = usersSlice.actions;
      export default usersSlice.reducer;
      `
    );
    mod(
      "reduxStore",
      `
      import { configureStore } from "@reduxjs/toolkit";
      import { useDispatch, useSelector } from "react-redux";
      import usersReducer from "${imp("usersSlice")}";

      // A factory instead of a singleton, so every app instance (and SSR request) gets its own store.
      export const makeStore = () => configureStore({ reducer: { users: usersReducer } });

      export type AppStore = ReturnType<typeof makeStore>;
      export type RootState = ReturnType<AppStore["getState"]>;
      export type AppDispatch = AppStore["dispatch"];

      export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
      export const useAppSelector = useSelector.withTypes<RootState>();
      `
    );
  }

  // ── components ──────────────────────────────────────────
  component(
    L.path("button"),
    "button",
    (s) => `
    import type { ButtonHTMLAttributes } from "react";
    import { cn } from "${imp("utils")}";
    __STYLES__

    export function Button({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
      return <button type={type} className={cn(${s.expr("root")}, className)} {...props} />;
    }
    `
  );

  component(
    L.path("header"),
    "header",
    (s) => `
    import { env } from "${imp("env")}";
    __STYLES__

    export function AppHeader() {
      return (
        <header ${s.attr("root")}>
          <div ${s.attr("inner")}>
            <span ${s.attr("logo")}>{env.appName}</span>
            <span ${s.attr("tagline")}>Scaffolded with create-apen</span>
          </div>
        </header>
      );
    }
    `
  );

  component(
    L.path("mainLayout"),
    "mainLayout",
    (s) => `
    import type { ReactNode } from "react";
    import { AppHeader } from "${imp("header")}";
    __STYLES__

    export function MainLayout({ children }: { children: ReactNode }) {
      return (
        <div ${s.attr("root")}>
          <AppHeader />
          <main ${s.attr("main")}>{children}</main>
        </div>
      );
    }
    `
  );

  component(
    L.path("userCard"),
    "userCard",
    (s) => `
    import type { User } from "${imp("userTypes")}";
    import { cn } from "${imp("utils")}";
    __STYLES__

    interface UserCardProps {
      user: User;
      selected?: boolean;
      onSelect?: (id: string) => void;
    }

    export function UserCard({ user, selected = false, onSelect }: UserCardProps) {
      return (
        <button type="button" className={cn(${s.expr("root")}, selected && ${s.expr("selected")})} onClick={() => onSelect?.(user.id)}>
          <span ${s.attr("name")}>{user.name}</span>
          <span ${s.attr("email")}>{user.email}</span>
        </button>
      );
    }
    `,
    { client: true }
  );

  const selection = useZustand
    ? {
        imports: `import { useUsersStore } from "${imp("usersStore")}";`,
        body: `const selectedUserId = useUsersStore((state) => state.selectedUserId);
      const selectUser = useUsersStore((state) => state.selectUser);`,
      }
    : useRedux
      ? {
          imports: `import { useAppDispatch, useAppSelector } from "${imp("reduxStore")}";
    import { selectUser as selectUserAction } from "${imp("usersSlice")}";`,
          body: `const selectedUserId = useAppSelector((state) => state.users.selectedUserId);
      const dispatch = useAppDispatch();
      const selectUser = (id: string) => dispatch(selectUserAction(id));`,
        }
      : {
          imports: `import { useState } from "react";`,
          body: `const [selectedUserId, selectUser] = useState<string | null>(null);`,
        };

  component(
    L.path("userList"),
    "userList",
    (s) => `
    ${selection.imports}
    import { Button } from "${imp("button")}";
    import { UserCard } from "${imp("userCard")}";
    import { useUsers } from "${imp("useUsers")}";
    __STYLES__

    export function UserList() {
      const { users, isLoading, error, refetch } = useUsers();
      ${selection.body}

      return (
        <section ${s.attr("root")}>
          <div ${s.attr("toolbar")}>
            <h2 ${s.attr("title")}>Users</h2>
            <Button onClick={() => void refetch()} disabled={isLoading}>
              {isLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>
          {error ? (
            <p ${s.attr("error")}>Could not reach the API: {error.message}. Is the backend running?</p>
          ) : users.length === 0 && !isLoading ? (
            <p ${s.attr("empty")}>
              No users yet — create one with <code>POST /api/users</code>.
            </p>
          ) : (
            <div ${s.attr("grid")}>
              {users.map((user) => (
                <UserCard key={user.id} user={user} selected={user.id === selectedUserId} onSelect={selectUser} />
              ))}
            </div>
          )}
        </section>
      );
    }
    `,
    { client: true }
  );

  if (feature) {
    const rel = (role) => `./${L.dir(role).replace(/^features\/users\//, "")}/${L.base(role)}`;
    mod(
      "featureIndex",
      `
      // Public API of the users feature. Code outside the feature imports from here only.
      export { UserList } from "${rel("userList")}";
      export { UserCard } from "${rel("userCard")}";
      export { useUsers } from "${rel("useUsers")}";
      export { ${serviceName} } from "${rel("usersApi")}";
      export type { User, CreateUserInput } from "${rel("userTypes")}";
      `
    );
  }

  const stack = JSON.stringify(ctx.stack);
  const homeBody = (s) => `
      <>
        <section ${s.attr("hero")}>
          <p ${s.attr("eyebrow")}>Apen Apps starter</p>
          <h1 ${s.attr("title")}>{env.appName}</h1>
          <p ${s.attr("lead")}>
            Your project is ready. The list below is loaded through the component → hook → service → API client
            flow described in the README.
          </p>
          <div ${s.attr("chips")}>
            {STACK.map((item) => (
              <span key={item} ${s.attr("chip")}>
                {item}
              </span>
            ))}
          </div>
        </section>
        <UserList />
      </>`;

  const providersFile = hasProviders
    ? (() => {
        component(
          L.path("providers"),
          "providers",
          () => `
          import { useState } from "react";
          import type { ReactNode } from "react";
          ${useQuery ? `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";` : ""}
          ${useRedux ? `import { Provider } from "react-redux";\nimport { makeStore } from "${imp("reduxStore")}";` : ""}

          /** App-wide providers: data fetching cache, global store, … */
          export function Providers({ children }: { children: ReactNode }) {
            ${useQuery ? `const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));` : ""}
            ${useRedux ? `const [store] = useState(makeStore);` : ""}
            return (
              ${useRedux ? "<Provider store={store}>" : ""}
              ${useQuery ? "<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>" : "<>{children}</>"}
              ${useRedux ? "</Provider>" : ""}
            );
          }
          `,
          { client: true }
        );
        return true;
      })()
    : false;

  if (next) {
    component(
      "src/app/page.tsx",
      "homePage",
      (s) => `
      import { UserList } from "${pub("userList")}";
      import { env } from "${imp("env")}";
      __STYLES__

      const STACK = ${stack};

      export default function HomePage() {
        return (${homeBody(s)}
        );
      }
      `
    );

    component(
      "src/app/not-found.tsx",
      "notFoundPage",
      (s) => `
      import Link from "next/link";
      __STYLES__

      export default function NotFound() {
        return (
          <div ${s.attr("root")}>
            <p ${s.attr("code")}>404</p>
            <p ${s.attr("text")}>This page does not exist.</p>
            <Link href="/">Go home</Link>
          </div>
        );
      }
      `
    );

    project.code(
      prefix + "src/app/layout.tsx",
      `
      import type { Metadata } from "next";
      import type { ReactNode } from "react";
      import { MainLayout } from "${imp("mainLayout")}";
      ${providersFile ? `import { Providers } from "${imp("providers")}";` : ""}
      import "./globals.css";

      export const metadata: Metadata = {
        title: ${JSON.stringify(ctx.title)},
        description: "Scaffolded with create-apen",
      };

      export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
        return (
          <html lang="en">
            <body>
              ${providersFile ? "<Providers>" : ""}
              <MainLayout>{children}</MainLayout>
              ${providersFile ? "</Providers>" : ""}
            </body>
          </html>
        );
      }
      `,
      fe.language
    );
  } else {
    component(
      L.path("homePage"),
      "homePage",
      (s) => `
      import { UserList } from "${pub("userList")}";
      import { env } from "${imp("env")}";
      __STYLES__

      const STACK = ${stack};

      export function HomePage() {
        return (${homeBody(s)}
        );
      }
      `
    );

    if (router) {
      component(
        L.path("notFoundPage"),
        "notFoundPage",
        (s) => `
        import { Link } from "react-router";
        __STYLES__

        export function NotFoundPage() {
          return (
            <div ${s.attr("root")}>
              <p ${s.attr("code")}>404</p>
              <p ${s.attr("text")}>This page does not exist.</p>
              <Link to="/">Go home</Link>
            </div>
          );
        }
        `
      );

      component(
        L.path("router"),
        "router",
        () => `
        import { createBrowserRouter, Outlet } from "react-router";
        import { MainLayout } from "${imp("mainLayout")}";
        import { HomePage } from "${imp("homePage")}";
        import { NotFoundPage } from "${imp("notFoundPage")}";

        export const router = createBrowserRouter([
          {
            element: (
              <MainLayout>
                <Outlet />
              </MainLayout>
            ),
            children: [
              { index: true, element: <HomePage /> },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ]);
        `
      );
    }

    component(
      L.path("app"),
      "app",
      () =>
        router
          ? `
        import { RouterProvider } from "react-router";
        import { router } from "${imp("router")}";

        export function App() {
          return <RouterProvider router={router} />;
        }
        `
          : `
        import { MainLayout } from "${imp("mainLayout")}";
        import { HomePage } from "${imp("homePage")}";

        export function App() {
          return (
            <MainLayout>
              <HomePage />
            </MainLayout>
          );
        }
        `
    );

    project.code(
      prefix + "src/main.tsx",
      `
      import { StrictMode } from "react";
      import { createRoot } from "react-dom/client";
      import { App } from "${imp("app")}";
      ${providersFile ? `import { Providers } from "${imp("providers")}";` : ""}
      import "./styles/globals.css";

      createRoot(document.getElementById("root")!).render(
        <StrictMode>
          ${providersFile ? "<Providers>" : ""}
          <App />
          ${providersFile ? "</Providers>" : ""}
        </StrictMode>
      );
      `,
      fe.language
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
          <div id="root"></div>
          <script type="module" src="/src/main.${ts ? "tsx" : "jsx"}"></script>
        </body>
      </html>
      `
    );
    if (ts) project.add(prefix + "src/vite-env.d.ts", `/// <reference types="vite/client" />\n`);
  }

  // ── global stylesheet ───────────────────────────────────
  const globalCss =
    fe.styling === "tailwind"
      ? `@import "tailwindcss";\n\n@theme {\n  --color-brand-blue: #00aeef;\n  --color-brand-orange: #f15a29;\n  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;\n}\n`
      : `${BASE_CSS}\n${cssRules.length ? `\n/* Component styles (BEM: block__element) */\n${cssRules.join("\n\n")}\n` : ""}`;
  project.add(prefix + globalCssPath, globalCss);

  // ── config files ────────────────────────────────────────
  writeReactConfig(ctx, { next, ts, useQuery, useZustand, useRedux, router });

  return describe(ctx, L, { next, router, hasProviders, useZustand, useRedux, globalCssPath });
}

function writeReactConfig(ctx, { next, ts, useQuery, useZustand, useRedux, router }) {
  const { project, prefix, fe } = ctx;
  const tailwind = fe.styling === "tailwind";
  const pick = (names) => Object.fromEntries(names.filter(Boolean).map((n) => [n, NPM[n]]));
  const dependencies = pick([
    next && "next",
    "react",
    "react-dom",
    router && "react-router",
    useQuery && "@tanstack/react-query",
    useZustand && "zustand",
    useRedux && "@reduxjs/toolkit",
    useRedux && "react-redux",
  ]);
  const devDependencies = pick([
    !next && "vite",
    !next && "@vitejs/plugin-react",
    tailwind && "tailwindcss",
    tailwind && (next ? "@tailwindcss/postcss" : "@tailwindcss/vite"),
    ts && "typescript",
    ts && "@types/react",
    ts && "@types/react-dom",
    (ts || !next) && "@types/node",
    ctx.extras.includes("prettier") && "prettier",
  ]);

  const scripts = next
    ? { dev: "next dev", build: "next build", start: "next start", ...(ts && { typecheck: "tsc --noEmit" }) }
    : {
        dev: "vite",
        build: ts ? "tsc --noEmit && vite build" : "vite build",
        preview: "vite preview",
        ...(ts && { typecheck: "tsc --noEmit" }),
      };
  if (ctx.extras.includes("prettier")) scripts.format = "prettier --write .";

  project.add(prefix + "package.json", {
    name: ctx.fullstack ? `${ctx.packageName}-frontend` : ctx.packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts,
    dependencies,
    devDependencies,
  });

  if (next) {
    project.code(
      prefix + "next.config.ts",
      `
      import type { NextConfig } from "next";

      // Requests to /api/* are proxied to the backend, so the browser only ever talks to one origin.
      const apiUrl = process.env.API_URL ?? "http://localhost:${ctx.apiPort}";

      const nextConfig: NextConfig = {
        output: "standalone",
        async rewrites() {
          return [{ source: "/api/:path*", destination: \`\${apiUrl}/api/:path*\` }];
        },
      };

      export default nextConfig;
      `,
      fe.language
    );
    if (!ts) {
      // next.config.js would be CommonJS-ambiguous; .mjs is always ESM.
      const js = project.files.get(prefix + "next.config.js");
      project.files.delete(prefix + "next.config.js");
      project.add(prefix + "next.config.mjs", js);
    }
    if (tailwind) project.add(prefix + "postcss.config.mjs", `export default {\n  plugins: { "@tailwindcss/postcss": {} },\n};\n`);
    project.add(prefix + "public/.gitkeep", "");
    project.add(prefix + (ts ? "tsconfig.json" : "jsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        ...(ts && { allowJs: true, skipLibCheck: true, strict: true, noEmit: true, isolatedModules: true, incremental: true }),
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        jsx: ts ? "react-jsx" : "preserve",
        ...(ts && { esModuleInterop: true, plugins: [{ name: "next" }] }),
        paths: { "@/*": ["./src/*"] },
      },
      include: ts ? ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"] : ["**/*.js", "**/*.jsx"],
      exclude: ["node_modules"],
    });
  } else {
    project.code(
      prefix + "vite.config.ts",
      `
      import { fileURLToPath, URL } from "node:url";
      import { defineConfig } from "vite";
      import react from "@vitejs/plugin-react";
      ${tailwind ? `import tailwindcss from "@tailwindcss/vite";` : ""}

      export default defineConfig({
        plugins: [react()${tailwind ? ", tailwindcss()" : ""}],
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
    project.add(prefix + "public/.gitkeep", "");
    project.add(prefix + (ts ? "tsconfig.json" : "jsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        ...(ts && {
          strict: true,
          noEmit: true,
          isolatedModules: true,
          skipLibCheck: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          types: ["vite/client"],
        }),
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src"],
    });
  }

  if (ctx.extras.includes("env")) {
    const vars = ENV_GUIDE(ctx, next ? "next" : "vite");
    project.add(prefix + ".env.example", vars);
    project.add(prefix + (next ? ".env.local" : ".env"), vars);
  }
}

// Folder descriptions + metadata for the README generator.
function describe(ctx, L, { next, router, hasProviders, useZustand, useRedux, globalCssPath }) {
  const fe = ctx.fe;
  const where = (role) => `src/${L.dir(role) ? L.dir(role) + "/" : ""}`;
  const folders = [];
  const seen = new Set();
  const add = (role, text) => {
    const dir = where(role);
    if (!seen.has(dir)) folders.push([dir, text]), seen.add(dir);
  };
  if (next) {
    folders.push(["src/app/", "Next.js App Router: routes (`page.tsx`), root `layout.tsx`, `not-found.tsx` and global CSS."]);
    seen.add("src/app/");
  }
  if (fe.structure === "feature") {
    folders.push(["src/features/users/", "Everything about the *users* feature: `components/`, `hooks/`, `api/`, `types/`" + (useZustand || useRedux ? ", `store/`" : "") + " and a public `index` file."]);
    add("button", "Reusable UI primitives shared by every feature.");
    add("header", "App shell pieces (header, layout).");
    add("apiClient", "Framework-agnostic helpers: the `fetch` wrapper (`apiClient`) and `cn()`.");
    add("env", "Typed access to environment variables.");
  } else {
    add("button", fe.structure === "atomic" ? "**Atoms** — smallest building blocks (Button)." : "Generic UI primitives (Button).");
    add("userCard", fe.structure === "atomic" ? "**Molecules** — small groups of atoms (UserCard)." : "Domain components for users.");
    add("userList", fe.structure === "atomic" ? "**Organisms** — complex sections (UserList, AppHeader)." : "Domain components for users.");
    add("header", "Layout components (AppHeader, MainLayout).");
    add("mainLayout", fe.structure === "atomic" ? "**Templates** — page layouts (MainLayout)." : "Layout components.");
    add("useUsers", "Custom hooks — stateful logic reused by components.");
    add("usersApi", "API services — one module per backend resource.");
    add("userTypes", "Shared TypeScript types.");
    add("apiClient", "Helpers: the `fetch` wrapper (`apiClient`) and `cn()`.");
    add("env", "Typed access to environment variables.");
    if (useZustand || useRedux) add(useRedux ? "reduxStore" : "usersStore", "Global client state.");
  }
  if (!next) add("homePage", fe.structure === "atomic" ? "**Pages** — templates filled with real content." : "Route-level page components.");
  if (!next && (router || hasProviders)) add("app", "App entry: root component" + (router ? ", router" : "") + (hasProviders ? ", providers" : "") + ".");
  if (!next) folders.push([globalCssPath.replace(/[^/]+$/, ""), "Global stylesheet."]);

  const js = (p) => (fe.language === "ts" ? p : p.replace(/\.tsx$/, ".jsx").replace(/\.ts$/, ".js"));
  return {
    folders,
    flowFiles: {
      component: js(L.path("userList")),
      hook: js(L.path("useUsers")),
      service: js(L.path("usersApi")),
      client: js(L.path("apiClient")),
    },
  };
}
