// Dockerfiles, nginx config and docker-compose for the generated project.
import { DB_URLS } from "../backend/express.js";
import { DOTNET_CONNECTION, SA_PASSWORD } from "../backend/dotnet.js";
import { PY_DB_URLS } from "../backend/fastapi.js";

const LOCKFILES = "package.json package-lock.json* pnpm-lock.yaml* yarn.lock* bun.lock* bun.lockb*";
const INSTALL = {
  npm: "npm install",
  pnpm: "corepack enable && pnpm install",
  yarn: "corepack enable && yarn install",
  bun: "npm install -g bun && bun install",
};

const DATABASE_SERVICES = {
  mongodb: (db) => ({
    image: "mongo:8",
    ports: ["27017:27017"],
    volumes: ["db-data:/data/db"],
    healthcheck: { test: `["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]` },
    env: { MONGO_INITDB_DATABASE: db },
  }),
  postgres: (db) => ({
    image: "postgres:17-alpine",
    ports: ["5432:5432"],
    volumes: ["db-data:/var/lib/postgresql/data"],
    healthcheck: { test: `["CMD-SHELL", "pg_isready -U postgres -d ${db}"]` },
    env: { POSTGRES_USER: "postgres", POSTGRES_PASSWORD: "postgres", POSTGRES_DB: db },
  }),
  mysql: (db) => ({
    image: "mysql:8.4",
    ports: ["3306:3306"],
    volumes: ["db-data:/var/lib/mysql"],
    healthcheck: { test: `["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]` },
    env: { MYSQL_DATABASE: db, MYSQL_USER: "app", MYSQL_PASSWORD: "app", MYSQL_ROOT_PASSWORD: "root" },
  }),
  sqlserver: () => ({
    image: "mcr.microsoft.com/mssql/server:2022-latest",
    platform: "linux/amd64",
    ports: ["1433:1433"],
    volumes: ["db-data:/var/opt/mssql"],
    env: { ACCEPT_EULA: "Y", MSSQL_SA_PASSWORD: SA_PASSWORD },
  }),
};

export function generateDocker(ctx) {
  const { project, config } = ctx;
  const fe = config.frontend;
  const be = config.backend;
  const fePrefix = ctx.fullstack ? "frontend/" : "";
  const bePrefix = ctx.fullstack ? "backend/" : "";
  const install = INSTALL[config.pm] ?? INSTALL.npm;

  // ── frontend ────────────────────────────────────────────
  if (fe) {
    if (fe.framework === "next") {
      project.add(
        fePrefix + "Dockerfile",
        `
        # syntax=docker/dockerfile:1
        FROM node:22-alpine AS deps
        WORKDIR /app
        COPY ${LOCKFILES} ./
        RUN ${install}

        FROM node:22-alpine AS build
        WORKDIR /app
        COPY --from=deps /app/node_modules ./node_modules
        COPY . .
        # /api/* rewrites are resolved at build time — point them at the backend service.
        ARG API_URL=http://backend:${ctx.apiPort}
        ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
        RUN npm run build

        FROM node:22-alpine AS runner
        WORKDIR /app
        ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
        COPY --from=build /app/public ./public
        COPY --from=build /app/.next/standalone ./
        COPY --from=build /app/.next/static ./.next/static
        EXPOSE 3000
        CMD ["node", "server.js"]
        `
      );
    } else {
      project.add(
        fePrefix + "Dockerfile",
        `
        # syntax=docker/dockerfile:1
        FROM node:22-alpine AS build
        WORKDIR /app
        COPY ${LOCKFILES} ./
        RUN ${install}
        COPY . .
        RUN npm run build

        # Static files served by nginx, which also proxies /api to the backend.
        FROM nginx:1.27-alpine
        COPY nginx.conf /etc/nginx/conf.d/default.conf
        COPY --from=build /app/dist /usr/share/nginx/html
        EXPOSE 80
        `
      );
      project.add(
        fePrefix + "nginx.conf",
        `
        server {
            listen 80;
            root /usr/share/nginx/html;
            index index.html;
        ${
          ctx.fullstack
            ? `
            location /api/ {
                proxy_pass http://backend:${ctx.apiPort};
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            }
        `
            : ""
        }
            # Single-page app: unknown paths fall back to index.html for client-side routing.
            location / {
                try_files $uri $uri/ /index.html;
            }
        }
        `
      );
    }
    project.add(fePrefix + ".dockerignore", "node_modules\ndist\n.next\n.env\n.env.local\nDockerfile\n.dockerignore\n");
  }

  // ── backend ─────────────────────────────────────────────
  if (be) {
    if (be.framework === "express") {
      const ts = be.language === "ts";
      const entry = ctx.backendInfo.entry;
      project.add(
        bePrefix + "Dockerfile",
        ts
          ? `
        # syntax=docker/dockerfile:1
        FROM node:22-alpine AS build
        WORKDIR /app
        COPY ${LOCKFILES} ./
        RUN ${install}
        COPY . .
        RUN npm run build

        FROM node:22-alpine
        WORKDIR /app
        ENV NODE_ENV=production
        COPY --from=build /app/package.json ./
        COPY --from=build /app/node_modules ./node_modules
        COPY --from=build /app/dist ./dist
        EXPOSE ${ctx.apiPort}
        CMD ["node", "${entry.replace(/^src\//, "dist/").replace(/\.ts$/, ".js")}"]
        `
          : `
        # syntax=docker/dockerfile:1
        FROM node:22-alpine
        WORKDIR /app
        ENV NODE_ENV=production
        COPY ${LOCKFILES} ./
        RUN ${install}
        COPY . .
        EXPOSE ${ctx.apiPort}
        CMD ["node", "${entry.replace(/\.ts$/, ".js")}"]
        `
      );
      project.add(bePrefix + ".dockerignore", "node_modules\ndist\n.env\nDockerfile\n.dockerignore\n");
    } else if (be.framework === "dotnet") {
      const { apiProject, apiDir } = ctx.backendInfo;
      project.add(
        bePrefix + "Dockerfile",
        `
        # syntax=docker/dockerfile:1
        FROM mcr.microsoft.com/dotnet/sdk:${ctx.dotnetMajor}.0 AS build
        WORKDIR /src
        COPY . .
        RUN dotnet publish ${apiDir}/${apiProject}.csproj -c Release -o /app/publish

        FROM mcr.microsoft.com/dotnet/aspnet:${ctx.dotnetMajor}.0
        WORKDIR /app
        ENV ASPNETCORE_HTTP_PORTS=${ctx.apiPort}
        COPY --from=build /app/publish .
        EXPOSE ${ctx.apiPort}
        ENTRYPOINT ["dotnet", "${apiProject}.dll"]
        `
      );
      project.add(bePrefix + ".dockerignore", "**/bin\n**/obj\n**/.vs\nDockerfile\n.dockerignore\n");
    } else {
      project.add(
        bePrefix + "Dockerfile",
        `
        # syntax=docker/dockerfile:1
        FROM python:3.12-slim
        WORKDIR /app
        ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
        COPY requirements.txt .
        RUN pip install --no-cache-dir -r requirements.txt
        COPY . .
        EXPOSE ${ctx.apiPort}
        CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${ctx.apiPort}"]
        `
      );
      project.add(bePrefix + ".dockerignore", ".venv\n__pycache__\n*.pyc\n.env\n*.db\nDockerfile\n.dockerignore\n");
    }
  }

  // ── docker-compose.yml ──────────────────────────────────
  const db = be && !["none", "sqlite"].includes(be.database) ? be.database : null;
  const svc = db ? DATABASE_SERVICES[db](ctx.dbName) : null;
  const yaml = ["services:"];
  const env = (obj) => Object.entries(obj).map(([k, v]) => `      ${k}: "${v}"`);

  if (svc) {
    yaml.push(
      "  db:",
      `    image: ${svc.image}`,
      ...(svc.platform ? [`    platform: ${svc.platform}`] : []),
      "    restart: unless-stopped",
      "    environment:",
      ...env(svc.env),
      "    ports:",
      ...svc.ports.map((p) => `      - "${p}"`),
      "    volumes:",
      ...svc.volumes.map((v) => `      - ${v}`),
      ...(svc.healthcheck ? ["    healthcheck:", `      test: ${svc.healthcheck.test}`, "      interval: 5s", "      timeout: 5s", "      retries: 20"] : []),
      ""
    );
  }

  if (be) {
    const frontendUrl = `http://localhost:${ctx.frontendPort}`;
    const backendEnv =
      be.framework === "express"
        ? { NODE_ENV: "production", PORT: ctx.apiPort, CLIENT_URL: frontendUrl, ...(db && { DATABASE_URL: DB_URLS[db](ctx.dbName, "db") }) }
        : be.framework === "dotnet"
          ? { ClientUrl: frontendUrl, ...(db && { ConnectionStrings__Default: DOTNET_CONNECTION[db](ctx.dbName, "db") }) }
          : {
              ENVIRONMENT: "production",
              CLIENT_URL: frontendUrl,
              ...(db && { DATABASE_URL: PY_DB_URLS[db](ctx.dbName, "db") }),
              ...(be.database === "sqlite" && { DATABASE_URL: "sqlite:////data/app.db" }),
            };
    yaml.push(
      "  backend:",
      `    build: ${ctx.fullstack ? "./backend" : "."}`,
      "    restart: unless-stopped",
      "    environment:",
      ...env(backendEnv),
      "    ports:",
      `      - "${ctx.apiPort}:${ctx.apiPort}"`,
      ...(be.database === "sqlite" ? ["    volumes:", "      - db-data:/data"] : []),
      ...(svc ? ["    depends_on:", "      db:", `        condition: ${svc.healthcheck ? "service_healthy" : "service_started"}`] : []),
      ""
    );
  }

  if (fe) {
    const next = fe.framework === "next";
    yaml.push(
      "  frontend:",
      "    build:",
      `      context: ${ctx.fullstack ? "./frontend" : "."}`,
      ...(next && be ? ["      args:", `        API_URL: http://backend:${ctx.apiPort}`] : []),
      "    restart: unless-stopped",
      "    ports:",
      `      - "${ctx.frontendPort}:${next ? 3000 : 80}"`,
      ...(be ? ["    depends_on:", "      - backend"] : []),
      ""
    );
  }

  if (svc || be?.database === "sqlite") yaml.push("volumes:", "  db-data:", "");
  project.add("docker-compose.yml", yaml.join("\n"));

  return { database: db, dbImage: svc?.image };
}
