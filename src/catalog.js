// Everything the CLI can generate. Questions, presets and generators all read from here.

export const PROJECT_TYPES = [
  { value: "fullstack", label: "Full-stack", hint: "frontend + backend in one repo" },
  { value: "frontend", label: "Frontend only" },
  { value: "backend", label: "Backend only" },
];

export const PRESETS = [
  { value: "mern", label: "MERN", hint: "MongoDB · Express · React · Node", frontend: "react", backend: "express", database: "mongodb" },
  { value: "pern", label: "PERN", hint: "PostgreSQL · Express · React · Node", frontend: "react", backend: "express", database: "postgres" },
  { value: "next-dotnet", label: "Next.js + .NET", hint: "Next.js · ASP.NET Core · PostgreSQL", frontend: "next", backend: "dotnet", database: "postgres" },
  { value: "react-dotnet", label: "React + .NET", hint: "React (Vite) · ASP.NET Core · SQL Server", frontend: "react", backend: "dotnet", database: "sqlserver" },
  { value: "next-express", label: "Next.js + Express", hint: "Next.js · Express · PostgreSQL", frontend: "next", backend: "express", database: "postgres" },
  { value: "vue-fastapi", label: "Vue + FastAPI", hint: "Vue (Vite) · FastAPI · PostgreSQL", frontend: "vue", backend: "fastapi", database: "postgres" },
  { value: "custom", label: "Custom", hint: "pick every piece yourself" },
];

export const FRONTENDS = [
  { value: "react", label: "React (Vite)", port: 5173 },
  { value: "next", label: "Next.js (App Router)", port: 3000 },
  { value: "vue", label: "Vue 3 (Vite)", port: 5173 },
];

export const BACKENDS = [
  { value: "express", label: "Node.js + Express", port: 4000 },
  { value: "dotnet", label: "ASP.NET Core Web API (.NET)", port: 5080 },
  { value: "fastapi", label: "Python + FastAPI", port: 8000 },
];

export const DATABASES = {
  express: [
    { value: "mongodb", label: "MongoDB", hint: "Mongoose" },
    { value: "postgres", label: "PostgreSQL", hint: "node-postgres" },
    { value: "mysql", label: "MySQL", hint: "mysql2" },
    { value: "none", label: "None", hint: "in-memory repository" },
  ],
  dotnet: [
    { value: "postgres", label: "PostgreSQL", hint: "EF Core + Npgsql" },
    { value: "sqlserver", label: "SQL Server", hint: "EF Core" },
    { value: "mongodb", label: "MongoDB", hint: "MongoDB.Driver" },
    { value: "none", label: "None", hint: "in-memory repository" },
  ],
  fastapi: [
    { value: "postgres", label: "PostgreSQL", hint: "SQLAlchemy 2 + psycopg" },
    { value: "mysql", label: "MySQL", hint: "SQLAlchemy 2 + PyMySQL" },
    { value: "sqlite", label: "SQLite", hint: "SQLAlchemy 2, zero setup" },
    { value: "none", label: "None", hint: "in-memory repository" },
  ],
};

export const LANGUAGES = [
  { value: "ts", label: "TypeScript" },
  { value: "js", label: "JavaScript" },
];

export const STYLING = [
  { value: "tailwind", label: "Tailwind CSS v4" },
  { value: "modules", label: "CSS Modules", hint: "Vue: scoped <style>" },
  { value: "css", label: "Plain CSS", hint: "one global stylesheet, BEM class names" },
];

export const FRONTEND_STRUCTURES = [
  {
    value: "feature",
    label: "Feature-based",
    hint: "features/<name>/{components,hooks,api} + shared/",
    description:
      "Code is grouped by business feature. Each feature owns its components, hooks, API calls and types and exposes a public `index` file. Cross-cutting building blocks live in `shared/`. Scales best for medium/large apps and teams.",
  },
  {
    value: "layer",
    label: "Layer-based (type-based)",
    hint: "components/ hooks/ lib/ services/ types/",
    description:
      "Code is grouped by technical role: all components together, all hooks together, all API services together. Easy to learn and great for small/medium apps.",
  },
  {
    value: "atomic",
    label: "Atomic Design",
    hint: "atoms/ molecules/ organisms/ templates/",
    description:
      "UI is split by complexity: atoms (buttons) → molecules (cards) → organisms (lists/sections) → templates (layouts) → pages. Logic lives in hooks/, services/ and lib/. Ideal for design-system heavy products.",
  },
];

export const NAMING = [
  { value: "pascal", label: "PascalCase components, camelCase modules", hint: "UserCard.tsx · useUsers.ts" },
  { value: "kebab", label: "kebab-case everything", hint: "user-card.tsx · use-users.ts" },
];

export const REACT_STATE = [
  { value: "query", label: "TanStack Query", hint: "server state / data fetching" },
  { value: "zustand", label: "Zustand", hint: "lightweight client state" },
  { value: "redux", label: "Redux Toolkit", hint: "predictable global state" },
];

export const BACKEND_ARCHITECTURES = {
  express: [
    {
      value: "layered",
      label: "Layered (MVC)",
      hint: "routes → controllers → services → repositories",
      description:
        "Classic layered architecture. Each technical layer has its own folder; a request travels routes → controllers → services → repositories → database.",
    },
    {
      value: "modular",
      label: "Modular (feature modules)",
      hint: "modules/users/{routes,controller,service,repository}",
      description:
        "Every domain feature is a self-contained module with its own routes, controller, service and repository. Shared infrastructure lives in `shared/`. Scales well as the API grows.",
    },
    {
      value: "clean",
      label: "Clean Architecture",
      hint: "domain / application / infrastructure / presentation",
      description:
        "Dependencies point inwards: `domain` (entities + repository contracts) knows nothing about frameworks, `application` holds use-cases, `infrastructure` implements persistence and `presentation` exposes HTTP.",
    },
  ],
  dotnet: [
    {
      value: "layered",
      label: "Layered (N-tier, single project)",
      hint: "Controllers / Services / Repositories / Models",
      description:
        "One Web API project split into Controllers → Services → Repositories → Data. Simple and familiar for most .NET teams.",
    },
    {
      value: "vertical",
      label: "Vertical Slice",
      hint: "Features/Users/{endpoints,handlers,dtos}",
      description:
        "Each feature is a slice that owns its endpoints, request/response DTOs and logic, using Minimal APIs. Shared infrastructure (DbContext, middleware) lives in `Common/`.",
    },
    {
      value: "clean",
      label: "Clean Architecture (multi-project)",
      hint: "Domain · Application · Infrastructure · Api",
      description:
        "A solution with four projects. `Domain` has entities and no dependencies, `Application` has services and interfaces, `Infrastructure` implements data access, `Api` hosts controllers and wires DI.",
    },
  ],
  fastapi: [
    {
      value: "layered",
      label: "Layered",
      hint: "api/ services/ repositories/ models/ schemas/",
      description:
        "Grouped by technical layer: routers in `api/`, business logic in `services/`, persistence in `repositories/`, ORM models in `models/` and Pydantic schemas in `schemas/`.",
    },
    {
      value: "modular",
      label: "Modular (feature modules)",
      hint: "modules/users/{router,service,repository,schemas}",
      description:
        "Each feature is a package with its own router, service, repository, models and schemas. Shared config and database setup live in `core/`.",
    },
  ],
};

export const EXTRAS = [
  { value: "docker", label: "Docker", hint: "Dockerfiles + docker-compose with database" },
  { value: "prettier", label: "Prettier + EditorConfig", hint: "consistent formatting" },
  { value: "ci", label: "GitHub Actions CI", hint: "build & check on every push" },
  { value: "env", label: ".env files", hint: ".env + .env.example" },
];

export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];

export const label = (list, value) => list.find((x) => x.value === value)?.label ?? value;
export const port = (list, value) => list.find((x) => x.value === value)?.port;
