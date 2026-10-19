// Node.js + Express generator: layered (MVC), modular, or clean architecture.
import path from "node:path";
import { NPM } from "../../versions.js";
import { dedent } from "../../utils/project.js";

// Where each piece lives for every architecture.
const FILES = {
  layered: {
    env: "src/config/env.ts",
    database: "src/config/database.ts",
    model: "src/models/user.model.ts",
    repository: "src/repositories/user.repository.ts",
    service: "src/services/user.service.ts",
    controller: "src/controllers/user.controller.ts",
    schema: "src/validators/user.validator.ts",
    routes: "src/routes/user.routes.ts",
    router: "src/routes/index.ts",
    httpError: "src/utils/http-error.ts",
    errorHandler: "src/middlewares/error-handler.ts",
    notFound: "src/middlewares/not-found.ts",
    app: "src/app.ts",
    server: "src/server.ts",
  },
  modular: {
    env: "src/shared/config/env.ts",
    database: "src/shared/database/connection.ts",
    model: "src/modules/users/users.model.ts",
    repository: "src/modules/users/users.repository.ts",
    service: "src/modules/users/users.service.ts",
    controller: "src/modules/users/users.controller.ts",
    schema: "src/modules/users/users.schema.ts",
    routes: "src/modules/users/users.routes.ts",
    router: "src/routes.ts",
    httpError: "src/shared/errors/http-error.ts",
    errorHandler: "src/shared/middlewares/error-handler.ts",
    notFound: "src/shared/middlewares/not-found.ts",
    app: "src/app.ts",
    server: "src/server.ts",
  },
  clean: {
    entity: "src/domain/entities/user.ts",
    repositoryContract: "src/domain/repositories/user-repository.ts",
    httpError: "src/application/errors/app-error.ts",
    listUsers: "src/application/use-cases/list-users.ts",
    createUser: "src/application/use-cases/create-user.ts",
    env: "src/infrastructure/config/env.ts",
    database: "src/infrastructure/database/connection.ts",
    model: "src/infrastructure/database/models/user.model.ts",
    repository: "src/infrastructure/repositories/user-repository.ts",
    controller: "src/presentation/http/controllers/user-controller.ts",
    schema: "src/presentation/http/validators/user-schema.ts",
    routes: "src/presentation/http/routes/user-routes.ts",
    errorHandler: "src/presentation/http/middlewares/error-handler.ts",
    notFound: "src/presentation/http/middlewares/not-found.ts",
    app: "src/presentation/http/app.ts",
    server: "src/main.ts",
  },
};

export const DB_URLS = {
  mongodb: (db, host = "localhost") => `mongodb://${host}:27017/${db}`,
  postgres: (db, host = "localhost") => `postgres://postgres:postgres@${host}:5432/${db}`,
  mysql: (db, host = "localhost") => `mysql://app:app@${host}:3306/${db}`,
};

export function generateExpress(ctx) {
  const { project, prefix, be } = ctx;
  const F = FILES[be.architecture];
  const clean = be.architecture === "clean";
  const db = be.database;
  const ts = be.language === "ts";
  // Relative ESM import between two generated files ("./x.js").
  const imp = (from, to) => {
    let rel = path.posix.relative(path.posix.dirname(F[from]), F[to]).replace(/\.ts$/, ".js");
    return rel.startsWith(".") ? rel : `./${rel}`;
  };
  const write = (key, code, opts) => project.code(prefix + F[key], code, be.language, opts);
  const userType = clean ? "entity" : "model";

  // ── config ──────────────────────────────────────────────
  write(
    "env",
    `
    import dotenv from "dotenv";

    dotenv.config({ quiet: true });

    export const env = {
      nodeEnv: process.env.NODE_ENV ?? "development",
      port: Number(process.env.PORT ?? ${ctx.apiPort}),
      clientUrl: process.env.CLIENT_URL ?? "http://localhost:${ctx.frontendPort}",
      ${db === "none" ? "" : `databaseUrl: process.env.DATABASE_URL ?? "${DB_URLS[db](ctx.dbName)}",`}
    };
    `
  );

  write("database", databaseModule(db, imp("database", "env")));

  // ── domain types / models ───────────────────────────────
  const userInterface = `
    export interface User {
      id: string;
      name: string;
      email: string;
      createdAt: Date;
    }

    export interface CreateUserInput {
      name: string;
      email: string;
    }
    `;
  if (clean) {
    write("entity", userInterface, { typesOnly: true });
    write(
      "repositoryContract",
      `
      import type { CreateUserInput, User } from "${imp("repositoryContract", "entity")}";

      // The domain only knows this contract — infrastructure provides the implementation.
      export interface UserRepository {
        findAll(): Promise<User[]>;
        findByEmail(email: string): Promise<User | null>;
        create(input: CreateUserInput): Promise<User>;
      }
      `,
      { typesOnly: true }
    );
  }
  if (db === "mongodb") {
    write(
      "model",
      `
      import mongoose, { Schema } from "mongoose";
      ${clean ? "" : dedent(userInterface)}
      const userSchema = new Schema(
        {
          name: { type: String, required: true, trim: true },
          email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        },
        { timestamps: true }
      );

      export const UserModel = mongoose.model("User", userSchema);
      `
    );
  } else if (!clean) {
    write("model", userInterface, { typesOnly: true });
  }

  // ── errors ──────────────────────────────────────────────
  const errorName = clean ? "AppError" : "HttpError";
  write(
    "httpError",
    `
    /** An error that carries an HTTP status code. Thrown anywhere, rendered by the error handler. */
    export class ${errorName} extends Error {
      status: number;

      constructor(status: number, message: string) {
        super(message);
        this.name = "${errorName}";
        this.status = status;
      }
    }
    `
  );

  // ── repository ──────────────────────────────────────────
  const repoImports = [
    `import type { CreateUserInput, User } from "${imp("repository", userType)}";`,
    clean ? `import type { UserRepository } from "${imp("repository", "repositoryContract")}";` : "",
    ...repositoryImports(db, imp("repository", "database"), db === "mongodb" ? imp("repository", "model") : null),
  ]
    .filter(Boolean)
    .join("\n");
  const methods = repositoryMethods(db);
  const repoClass = { mongodb: "MongoUserRepository", postgres: "PostgresUserRepository", mysql: "MySqlUserRepository", none: "InMemoryUserRepository" }[db];
  write(
    "repository",
    clean
      ? `
      ${repoImports}
      ${repositoryHelpers(db)}
      export class ${repoClass} implements UserRepository {
        ${methods.join("\n\n")}
      }
      `
      : `
      ${repoImports}
      ${repositoryHelpers(db)}
      // Data access only — no business rules here.
      export const userRepository = {
        ${methods.join(",\n\n")},
      };
      `
  );

  // ── validation ──────────────────────────────────────────
  write(
    "schema",
    `
    import { z } from "zod";

    export const createUserSchema = z.object({
      name: z.string().trim().min(2, "Name must be at least 2 characters"),
      email: z.email("A valid email is required"),
    });
    `
  );

  // ── business logic ──────────────────────────────────────
  if (clean) {
    write(
      "listUsers",
      `
      import type { User } from "${imp("listUsers", "entity")}";
      import type { UserRepository } from "${imp("listUsers", "repositoryContract")}";

      export class ListUsers {
        private readonly users: UserRepository;

        constructor(users: UserRepository) {
          this.users = users;
        }

        execute(): Promise<User[]> {
          return this.users.findAll();
        }
      }
      `
    );
    write(
      "createUser",
      `
      import type { CreateUserInput, User } from "${imp("createUser", "entity")}";
      import type { UserRepository } from "${imp("createUser", "repositoryContract")}";
      import { AppError } from "${imp("createUser", "httpError")}";

      export class CreateUser {
        private readonly users: UserRepository;

        constructor(users: UserRepository) {
          this.users = users;
        }

        async execute(input: CreateUserInput): Promise<User> {
          if (await this.users.findByEmail(input.email)) {
            throw new AppError(409, "A user with this email already exists");
          }
          return this.users.create(input);
        }
      }
      `
    );
  } else {
    write(
      "service",
      `
      import { userRepository } from "${imp("service", "repository")}";
      import { HttpError } from "${imp("service", "httpError")}";
      import type { CreateUserInput } from "${imp("service", "model")}";

      // Business rules live here; controllers stay thin and repositories stay dumb.
      export const userService = {
        listUsers() {
          return userRepository.findAll();
        },

        async createUser(input: CreateUserInput) {
          if (await userRepository.findByEmail(input.email)) {
            throw new HttpError(409, "A user with this email already exists");
          }
          return userRepository.create(input);
        },
      };
      `
    );
  }

  // ── HTTP layer ──────────────────────────────────────────
  if (clean) {
    write(
      "controller",
      `
      import type { Request, Response } from "express";
      import type { ListUsers } from "${imp("controller", "listUsers")}";
      import type { CreateUser } from "${imp("controller", "createUser")}";
      import { createUserSchema } from "${imp("controller", "schema")}";

      export class UserController {
        private readonly listUsers: ListUsers;
        private readonly createUser: CreateUser;

        constructor(listUsers: ListUsers, createUser: CreateUser) {
          this.listUsers = listUsers;
          this.createUser = createUser;
        }

        list = async (_req: Request, res: Response) => {
          res.json({ data: await this.listUsers.execute() });
        };

        create = async (req: Request, res: Response) => {
          const input = createUserSchema.parse(req.body);
          res.status(201).json({ data: await this.createUser.execute(input) });
        };
      }
      `
    );
    write(
      "routes",
      `
      import { Router } from "express";
      import type { UserController } from "${imp("routes", "controller")}";

      export function createUserRoutes(controller: UserController) {
        const router = Router();
        router.get("/", controller.list);
        router.post("/", controller.create);
        return router;
      }
      `
    );
  } else {
    write(
      "controller",
      `
      import type { Request, Response } from "express";
      import { userService } from "${imp("controller", "service")}";
      import { createUserSchema } from "${imp("controller", "schema")}";

      // Controllers translate HTTP ⇄ service calls. Express 5 forwards async errors automatically.
      export const userController = {
        async list(_req: Request, res: Response) {
          res.json({ data: await userService.listUsers() });
        },

        async create(req: Request, res: Response) {
          const input = createUserSchema.parse(req.body);
          res.status(201).json({ data: await userService.createUser(input) });
        },
      };
      `
    );
    write(
      "routes",
      `
      import { Router } from "express";
      import { userController } from "${imp("routes", "controller")}";

      export const userRoutes = Router();

      userRoutes.get("/", userController.list);
      userRoutes.post("/", userController.create);
      `
    );
    write(
      "router",
      `
      import { Router } from "express";
      import { userRoutes } from "${imp("router", "routes")}";

      // Every feature router is mounted here, under /api.
      export const apiRouter = Router();

      apiRouter.get("/health", (_req, res) => {
        res.json({ data: { status: "ok", uptime: process.uptime() } });
      });
      apiRouter.use("/users", userRoutes);
      `
    );
  }

  write(
    "errorHandler",
    `
    import type { NextFunction, Request, Response } from "express";
    import { ZodError } from "zod";
    import { ${errorName} } from "${imp("errorHandler", "httpError")}";
    import { env } from "${imp("errorHandler", "env")}";

    // Single place where errors become HTTP responses: { error: { message, details? } }
    export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: { message: "Validation failed", details: err.issues } });
        return;
      }
      if (err instanceof ${errorName}) {
        res.status(err.status).json({ error: { message: err.message } });
        return;
      }
      console.error(err);
      const message = env.nodeEnv === "production" ? "Internal server error" : String(err);
      res.status(500).json({ error: { message } });
    }
    `
  );
  write(
    "notFound",
    `
    import type { Request, Response } from "express";

    export function notFound(req: Request, res: Response) {
      res.status(404).json({ error: { message: \`Route \${req.method} \${req.originalUrl} not found\` } });
    }
    `
  );

  const middlewareSetup = `
      app.use(helmet());
      app.use(cors({ origin: env.clientUrl }));
      app.use(express.json());
      app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));`;

  if (clean) {
    write(
      "app",
      `
      import express from "express";
      import cors from "cors";
      import helmet from "helmet";
      import morgan from "morgan";
      import { env } from "${imp("app", "env")}";
      import type { UserController } from "${imp("app", "controller")}";
      import { createUserRoutes } from "${imp("app", "routes")}";
      import { errorHandler } from "${imp("app", "errorHandler")}";
      import { notFound } from "${imp("app", "notFound")}";

      export function createApp(deps: { userController: UserController }) {
        const app = express();
        ${middlewareSetup}

        app.get("/api/health", (_req, res) => {
          res.json({ data: { status: "ok", uptime: process.uptime() } });
        });
        app.use("/api/users", createUserRoutes(deps.userController));

        app.use(notFound);
        app.use(errorHandler);
        return app;
      }
      `
    );
    write(
      "server",
      `
      // Composition root: the only place that knows every concrete implementation.
      import { env } from "${imp("server", "env")}";
      import { connectDatabase } from "${imp("server", "database")}";
      import { ${repoClass} } from "${imp("server", "repository")}";
      import { ListUsers } from "${imp("server", "listUsers")}";
      import { CreateUser } from "${imp("server", "createUser")}";
      import { UserController } from "${imp("server", "controller")}";
      import { createApp } from "${imp("server", "app")}";

      await connectDatabase();

      const userRepository = new ${repoClass}();
      const userController = new UserController(new ListUsers(userRepository), new CreateUser(userRepository));
      const app = createApp({ userController });

      app.listen(env.port, () => {
        console.log(\`🚀 API ready on http://localhost:\${env.port}/api\`);
      });
      `
    );
  } else {
    write(
      "app",
      `
      import express from "express";
      import cors from "cors";
      import helmet from "helmet";
      import morgan from "morgan";
      import { env } from "${imp("app", "env")}";
      import { apiRouter } from "${imp("app", "router")}";
      import { errorHandler } from "${imp("app", "errorHandler")}";
      import { notFound } from "${imp("app", "notFound")}";

      export function createApp() {
        const app = express();
        ${middlewareSetup}

        app.use("/api", apiRouter);

        app.use(notFound);
        app.use(errorHandler);
        return app;
      }
      `
    );
    write(
      "server",
      `
      import { createApp } from "${imp("server", "app")}";
      import { connectDatabase } from "${imp("server", "database")}";
      import { env } from "${imp("server", "env")}";

      await connectDatabase();

      createApp().listen(env.port, () => {
        console.log(\`🚀 API ready on http://localhost:\${env.port}/api\`);
      });
      `
    );
  }

  // ── package.json / tsconfig / env ───────────────────────
  const entry = F.server;
  const pick = (names) => Object.fromEntries(names.filter(Boolean).map((n) => [n, NPM[n]]));
  const dbDeps = { mongodb: ["mongoose"], postgres: ["pg"], mysql: ["mysql2"], none: [] }[db];
  project.add(prefix + "package.json", {
    name: ctx.fullstack ? `${ctx.packageName}-backend` : ctx.packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: ts
      ? {
          dev: `tsx watch --clear-screen=false ${entry}`,
          build: "tsc",
          start: `node ${entry.replace(/^src\//, "dist/").replace(/\.ts$/, ".js")}`,
          typecheck: "tsc --noEmit",
          ...(ctx.extras.includes("prettier") && { format: "prettier --write ." }),
        }
      : {
          dev: `node --watch ${entry.replace(/\.ts$/, ".js")}`,
          start: `node ${entry.replace(/\.ts$/, ".js")}`,
          ...(ctx.extras.includes("prettier") && { format: "prettier --write ." }),
        },
    engines: { node: ">=20" },
    dependencies: pick(["express", "cors", "helmet", "morgan", "dotenv", "zod", ...dbDeps]),
    devDependencies: pick([
      ts && "typescript",
      ts && "tsx",
      ts && "@types/node",
      ts && "@types/express",
      ts && "@types/cors",
      ts && "@types/morgan",
      ts && db === "postgres" && "@types/pg",
      ctx.extras.includes("prettier") && "prettier",
    ]),
  });

  if (ts) {
    project.add(prefix + "tsconfig.json", {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        sourceMap: true,
      },
      include: ["src"],
    });
  }

  if (ctx.extras.includes("env")) {
    const vars = [
      `NODE_ENV=development`,
      `PORT=${ctx.apiPort}`,
      `CLIENT_URL=http://localhost:${ctx.frontendPort}`,
      db !== "none" && `DATABASE_URL=${DB_URLS[db](ctx.dbName)}`,
    ]
      .filter(Boolean)
      .join("\n");
    project.add(prefix + ".env.example", vars + "\n");
    project.add(prefix + ".env", vars + "\n");
  }

  const js = (p) => (ts ? p : p.replace(/\.ts$/, ".js"));
  return {
    entry: F.server,
    flowFiles: clean
      ? [
          ["Route", js(F.routes)],
          ["Controller", js(F.controller)],
          ["Use case", js(F.createUser)],
          ["Repository", js(F.repository)],
        ]
      : [
          ["Route", js(F.routes)],
          ["Controller", js(F.controller)],
          ["Service", js(F.service)],
          ["Repository", js(F.repository)],
        ],
    folders: foldersFor(be.architecture, db),
  };
}

function databaseModule(db, envImport) {
  switch (db) {
    case "mongodb":
      return `
      import mongoose from "mongoose";
      import { env } from "${envImport}";

      export async function connectDatabase() {
        await mongoose.connect(env.databaseUrl);
        console.log("✔ Connected to MongoDB");
      }
      `;
    case "postgres":
      return `
      import pg from "pg";
      import { env } from "${envImport}";

      export const pool = new pg.Pool({ connectionString: env.databaseUrl });

      export async function connectDatabase() {
        // Starter schema. Swap for a migration tool (e.g. node-pg-migrate, Drizzle, Prisma) as the app grows.
        await pool.query(\`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        \`);
        console.log("✔ Connected to PostgreSQL");
      }
      `;
    case "mysql":
      return `
      import mysql from "mysql2/promise";
      import { env } from "${envImport}";

      export const pool = mysql.createPool(env.databaseUrl);

      export async function connectDatabase() {
        // Starter schema. Swap for a migration tool (e.g. Knex, Drizzle, Prisma) as the app grows.
        await pool.query(\`
          CREATE TABLE IF NOT EXISTS users (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        \`);
        console.log("✔ Connected to MySQL");
      }
      `;
    default:
      return `
      // No database selected — data lives in memory and resets on restart.
      export async function connectDatabase() {}
      `;
  }
}

function repositoryImports(db, databaseImport, modelImport) {
  switch (db) {
    case "mongodb":
      return [`import { UserModel } from "${modelImport}";`];
    case "postgres":
      return [`import { randomUUID } from "node:crypto";`, `import type { QueryResultRow } from "pg";`, `import { pool } from "${databaseImport}";`];
    case "mysql":
      return [`import { randomUUID } from "node:crypto";`, `import type { RowDataPacket } from "mysql2";`, `import { pool } from "${databaseImport}";`];
    default:
      return [`import { randomUUID } from "node:crypto";`];
  }
}

function repositoryHelpers(db) {
  switch (db) {
    case "mongodb":
      return `
      function toUser(doc: { _id: unknown; name: string; email: string; createdAt: Date }): User {
        return { id: String(doc._id), name: doc.name, email: doc.email, createdAt: doc.createdAt };
      }
      `;
    case "postgres":
      return `
      const COLUMNS = \`id, name, email, created_at AS "createdAt"\`;

      type UserRow = User & QueryResultRow;
      `;
    case "mysql":
      return `
      const COLUMNS = "id, name, email, created_at AS createdAt";

      type UserRow = User & RowDataPacket;
      `;
    default:
      return `
      // In-memory store: resets on every restart. Pick a database to persist data.
      const USERS: User[] = [];
      `;
  }
}

function repositoryMethods(db) {
  switch (db) {
    case "mongodb":
      return [
        `async findAll(): Promise<User[]> {
          const docs = await UserModel.find().sort({ createdAt: -1 }).lean();
          return docs.map(toUser);
        }`,
        `async findByEmail(email: string): Promise<User | null> {
          const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean();
          return doc ? toUser(doc) : null;
        }`,
        `async create(input: CreateUserInput): Promise<User> {
          const doc = await UserModel.create(input);
          return toUser(doc);
        }`,
      ];
    case "postgres":
      return [
        `async findAll(): Promise<User[]> {
          const { rows } = await pool.query<UserRow>(\`SELECT \${COLUMNS} FROM users ORDER BY created_at DESC\`);
          return rows;
        }`,
        `async findByEmail(email: string): Promise<User | null> {
          const { rows } = await pool.query<UserRow>(\`SELECT \${COLUMNS} FROM users WHERE email = $1\`, [email]);
          return rows[0] ?? null;
        }`,
        `async create(input: CreateUserInput): Promise<User> {
          const { rows } = await pool.query<UserRow>(
            \`INSERT INTO users (id, name, email) VALUES ($1, $2, $3) RETURNING \${COLUMNS}\`,
            [randomUUID(), input.name, input.email]
          );
          return rows[0];
        }`,
      ];
    case "mysql":
      return [
        `async findAll(): Promise<User[]> {
          const [rows] = await pool.query<UserRow[]>(\`SELECT \${COLUMNS} FROM users ORDER BY created_at DESC\`);
          return rows;
        }`,
        `async findByEmail(email: string): Promise<User | null> {
          const [rows] = await pool.query<UserRow[]>(\`SELECT \${COLUMNS} FROM users WHERE email = ?\`, [email]);
          return rows[0] ?? null;
        }`,
        `async create(input: CreateUserInput): Promise<User> {
          const id = randomUUID();
          await pool.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", [id, input.name, input.email]);
          const [rows] = await pool.query<UserRow[]>(\`SELECT \${COLUMNS} FROM users WHERE id = ?\`, [id]);
          return rows[0];
        }`,
      ];
    default:
      return [
        `async findAll(): Promise<User[]> {
          return [...USERS];
        }`,
        `async findByEmail(email: string): Promise<User | null> {
          return USERS.find((user) => user.email === email) ?? null;
        }`,
        `async create(input: CreateUserInput): Promise<User> {
          const user: User = { id: randomUUID(), ...input, createdAt: new Date() };
          USERS.push(user);
          return user;
        }`,
      ];
  }
}

function foldersFor(architecture, db) {
  const dbText = db === "none" ? "In-memory store (no database selected)." : "Database connection and starter schema.";
  if (architecture === "layered")
    return [
      ["src/routes/", "URL → controller mapping. `index` mounts every router under `/api`."],
      ["src/controllers/", "Parse/validate the request, call a service, send the response."],
      ["src/services/", "Business rules (e.g. *email must be unique*)."],
      ["src/repositories/", "Data access only — the only layer that talks to the database."],
      ["src/models/", db === "mongodb" ? "Mongoose schemas and domain types." : "Domain types."],
      ["src/validators/", "Zod schemas for request bodies."],
      ["src/middlewares/", "Error handler and 404 handler."],
      ["src/config/", `Environment variables and ${dbText.toLowerCase()}`],
      ["src/utils/", "Small helpers (`HttpError`)."],
    ];
  if (architecture === "modular")
    return [
      ["src/modules/users/", "The users module: routes, controller, service, repository, model and schema side by side."],
      ["src/shared/", "Cross-module infrastructure: config, database, errors, middlewares."],
      ["src/routes.ts", "Mounts every module router under `/api`."],
    ];
  return [
    ["src/domain/", "Entities and repository *contracts*. No framework imports."],
    ["src/application/", "Use cases (`ListUsers`, `CreateUser`) and application errors."],
    ["src/infrastructure/", `Concrete implementations: config, ${dbText.toLowerCase().replace(/\.$/, "")}, repositories.`],
    ["src/presentation/http/", "Express app, controllers, routes, validators, middlewares."],
    ["src/main.ts", "Composition root — wires repositories → use cases → controllers."],
  ];
}
