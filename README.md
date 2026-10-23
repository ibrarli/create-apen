# create-apen

Scaffold a production-ready project in one command, organised the way **you** like it.

`create-apen` asks a few questions (stack, language, styling, state management, how you organise files, naming convention, backend architecture, database, extras), then it:

- generates the frontend and/or backend with a working starter feature,
- lays out folders using the structure you chose,
- installs dependencies (npm / pnpm / yarn / bun, `dotnet restore`, Python venv + pip),
- adds Docker, docker-compose with your database, CI, Prettier and `.env` files,
- writes a README that explains the structure and walks through a request from the UI to the database,
- creates a git repository with a first commit.

Built by [Apen Apps](https://www.apenapps.com). The terminal UI uses the Apen brand colors.

## Quick start

```bash
npx create-apen@latest
# or
npm create apen@latest
pnpm create apen
yarn create apen
bun create apen
```

Skip the questions:

```bash
npx create-apen my-shop --preset mern --yes
npx create-apen dashboard --preset next-dotnet --yes --pm pnpm
npx create-apen web --type frontend --frontend vue
```

## What you can generate

### Presets (full-stack)

| Preset | Frontend | Backend | Database |
| --- | --- | --- | --- |
| `mern` | React (Vite) | Express | MongoDB |
| `pern` | React (Vite) | Express | PostgreSQL |
| `next-dotnet` | Next.js | ASP.NET Core | PostgreSQL |
| `react-dotnet` | React (Vite) | ASP.NET Core | SQL Server |
| `next-express` | Next.js | Express | PostgreSQL |
| `vue-fastapi` | Vue 3 (Vite) | FastAPI | PostgreSQL |
| `custom` | any | any | any |

You can also generate **frontend only** or **backend only** projects.

### Frontend options

| Question | Choices |
| --- | --- |
| Framework | React (Vite), Next.js (App Router), Vue 3 (Vite) |
| Language | TypeScript, JavaScript |
| Styling | Tailwind CSS v4, CSS Modules (Vue: scoped styles), plain CSS (BEM) |
| State & data | TanStack Query, Zustand, Redux Toolkit (React) · Pinia (Vue) |
| Routing | React Router / Vue Router (Next.js uses the App Router) |
| **Folder structure** | **Feature-based** (`features/<name>/…` + `shared/`), **Layer-based** (`components/ hooks/ lib/ services/ types/`), **Atomic Design** (`atoms/ molecules/ organisms/ templates/`) |
| **File naming** | PascalCase components + camelCase modules, or kebab-case everything |

### Backend options

| Framework | Architectures | Databases |
| --- | --- | --- |
| Node.js + Express (TS or JS) | Layered (MVC), Modular, Clean Architecture | MongoDB (Mongoose), PostgreSQL (pg), MySQL (mysql2), in-memory |
| ASP.NET Core Web API | Layered (N-tier), Vertical Slice, Clean Architecture (4 projects) | PostgreSQL / SQL Server (EF Core), MongoDB, in-memory |
| Python + FastAPI | Layered, Modular | PostgreSQL / MySQL / SQLite (SQLAlchemy 2), in-memory |

### Extras

- **Docker**: a Dockerfile per app (multi-stage; nginx for Vite apps; standalone output for Next.js) and `docker-compose.yml` with the database, health checks and volumes.
- **Prettier + EditorConfig**
- **GitHub Actions CI**: builds every app, plus `docker compose build`.
- **.env files**: `.env` and `.env.example` for every app.

## What the generated project looks like

Each project ships with a small **users** feature that runs through every layer, so the wiring is already in place:

```
UserList (component) → useUsers (hook) → userService → apiClient
    → /api/users → controller → service → repository → database
```

- Every API returns `{ "data": ... }` on success and `{ "error": { "message": "..." } }` on failure.
- In development, the frontend proxies `/api` to the backend (Vite proxy or Next.js rewrites). In Docker, nginx or Next.js does the proxying. The browser never needs CORS.
- The generated README has the folder tree, a Mermaid sequence diagram of the request flow, the conventions in use and the steps for adding a new feature.

## CLI options

```
npx create-apen [project-name] [options]

--preset <name>     mern | pern | next-dotnet | react-dotnet | next-express | vue-fastapi | custom
--type <type>       fullstack | frontend | backend
--frontend <name>   react | next | vue
--backend <name>    express | dotnet | fastapi
--extras <list>     comma-separated: docker,prettier,ci,env
--pm <name>         npm | pnpm | yarn | bun
--no-install        skip installing dependencies
--no-git            skip git init + first commit
-y, --yes           accept defaults for every unanswered question
-v, --version
-h, --help
```

## Requirements

- Node.js 20+
- .NET SDK 8+ for .NET backends. The generated project targets the SDK installed on your machine, or .NET 10 if none is found.
- Python 3.10+ for FastAPI backends
- Docker (optional)

## Development

```bash
git clone https://github.com/ibrarli/create-apen
cd create-apen
npm install
npm test              # generates every stack/structure/language/database combination and checks the output
node bin/index.js     # run the CLI locally
```

How the code is organised:

```
src/
├── index.js              # orchestration: questions → generate → write → install → git
├── questions.js          # the interactive flow
├── catalog.js            # every option, preset, structure and architecture
├── versions.js           # pinned dependency versions for generated projects
├── ui/                   # Apen-themed prompts (built on @clack/core) and colors
├── utils/                # in-memory project tree, TS→JS emitter, naming, process helpers
└── generators/
    ├── frontend/         # react.js (React + Next.js), vue.js, folder-structure map, styles
    ├── backend/          # express.js, dotnet.js, fastapi.js
    └── shared/           # docker, root files (CI, gitignore, scripts), README
```

Templates are written once in TypeScript. JavaScript variants come from stripping the types with [sucrase](https://github.com/alangpierce/sucrase), so the two never drift apart.

## License

MIT © Apen Apps
