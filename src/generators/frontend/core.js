// Framework-agnostic data layer shared by every frontend: env config, API client, types, service.
export function writeDataLayer(ctx, L, { serviceName, envFlavor }) {
  const { project, prefix, fe } = ctx;
  const mod = (role, code, opts) => project.code(prefix + L.path(role), code, fe.language, opts);
  const imp = (role) => L.import(role);

  mod(
    "env",
    envFlavor === "next"
      ? `
    // Public runtime config. NEXT_PUBLIC_* variables are inlined at build time.
    export const env = {
      apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
      appName: process.env.NEXT_PUBLIC_APP_NAME ?? ${JSON.stringify(ctx.title)},
    };
    `
      : `
    // Public runtime config. Only VITE_* variables are exposed to the browser.
    export const env = {
      apiUrl: import.meta.env.VITE_API_URL ?? "/api",
      appName: import.meta.env.VITE_APP_NAME ?? ${JSON.stringify(ctx.title)},
    };
    `
  );

  mod(
    "apiClient",
    `
    import { env } from "${imp("env")}";

    export class ApiError extends Error {
      status: number;

      constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
      }
    }

    async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const response = await fetch(\`\${env.apiUrl}\${path}\`, {
        ...init,
        headers: { "Content-Type": "application/json", ...init.headers },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiError(response.status, body?.error?.message ?? response.statusText);
      }
      // Every backend endpoint wraps its payload as { data: ... }
      return body.data;
    }

    export const apiClient = {
      get: <T>(path: string) => request<T>(path),
      post: <T>(path: string, data: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data) }),
    };
    `
  );

  mod(
    "userTypes",
    `
    export interface User {
      id: string;
      name: string;
      email: string;
      createdAt: string;
    }

    export interface CreateUserInput {
      name: string;
      email: string;
    }
    `,
    { typesOnly: true }
  );

  mod(
    "usersApi",
    `
    import { apiClient } from "${imp("apiClient")}";
    import type { CreateUserInput, User } from "${imp("userTypes")}";

    // All HTTP calls for the users resource live here — components never call fetch directly.
    export const ${serviceName} = {
      list: () => apiClient.get<User[]>("/users"),
      create: (input: CreateUserInput) => apiClient.post<User>("/users", input),
    };
    `
  );
}

export const ENV_GUIDE = (ctx, flavor) =>
  flavor === "next"
    ? `# Public (inlined into the browser bundle)\nNEXT_PUBLIC_APP_NAME=${ctx.title}\n# Leave empty to use the /api proxy defined in next.config\n# NEXT_PUBLIC_API_URL=\n\n# Server-side: where /api/* is proxied to\nAPI_URL=http://localhost:${ctx.apiPort}\n`
    : `VITE_APP_NAME=${ctx.title}\n# Leave unset to use the /api dev proxy in vite.config\n# VITE_API_URL=http://localhost:${ctx.apiPort}/api\n\n# Dev proxy target\nAPI_URL=http://localhost:${ctx.apiPort}\n`;
