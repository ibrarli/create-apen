// Python + FastAPI generator: layered or modular.
import { PYTHON } from "../../versions.js";

export const PY_DB_URLS = {
  postgres: (db, host = "localhost") => `postgresql+psycopg://postgres:postgres@${host}:5432/${db}`,
  mysql: (db, host = "localhost") => `mysql+pymysql://app:app@${host}:3306/${db}`,
  sqlite: () => "sqlite:///./app.db",
};

export function generateFastapi(ctx) {
  const { project, prefix, be } = ctx;
  const db = be.database;
  const sql = db !== "none";
  const modular = be.architecture === "modular";
  const py = (rel, code) => project.add(prefix + rel, code);

  // module paths (dotted) and file paths per architecture
  const M = modular
    ? {
        config: "app.core.config",
        errors: "app.core.errors",
        database: "app.core.database",
        models: "app.modules.users.models",
        schemas: "app.modules.users.schemas",
        repository: "app.modules.users.repository",
        service: "app.modules.users.service",
        router: "app.modules.users.router",
      }
    : {
        config: "app.core.config",
        errors: "app.core.errors",
        database: "app.db.session",
        models: "app.models.user",
        schemas: "app.schemas.user",
        repository: "app.repositories.user_repository",
        service: "app.services.user_service",
        router: "app.api.routes.users",
      };
  const file = (mod) => mod.replace(/\./g, "/") + ".py";

  // __init__.py for every package
  const packages = new Set(["app"]);
  for (const mod of Object.values(M)) {
    const parts = mod.split(".").slice(0, -1);
    for (let i = 1; i <= parts.length; i++) packages.add(parts.slice(0, i).join("/"));
  }
  if (!modular) packages.add("app/api");
  for (const pkg of packages) py(`${pkg}/__init__.py`, "");

  py(
    file(M.config),
    `
    from pydantic_settings import BaseSettings, SettingsConfigDict


    class Settings(BaseSettings):
        """Reads configuration from environment variables (and .env)."""

        model_config = SettingsConfigDict(env_file=".env", extra="ignore")

        app_name: str = "${ctx.title} API"
        environment: str = "development"
        client_url: str = "http://localhost:${ctx.frontendPort}"
        ${sql ? `database_url: str = "${PY_DB_URLS[db](ctx.dbName)}"` : ""}


    settings = Settings()
    `
  );

  py(
    file(M.errors),
    `
    from fastapi import FastAPI, Request
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse


    class AppError(Exception):
        """An error that maps to an HTTP status code."""

        def __init__(self, status_code: int, message: str):
            super().__init__(message)
            self.status_code = status_code
            self.message = message


    def register_error_handlers(app: FastAPI) -> None:
        """Every error is returned as { "error": { "message": ..., "details"?: ... } }."""

        @app.exception_handler(AppError)
        async def handle_app_error(_request: Request, exc: AppError):
            return JSONResponse(status_code=exc.status_code, content={"error": {"message": exc.message}})

        @app.exception_handler(RequestValidationError)
        async def handle_validation_error(_request: Request, exc: RequestValidationError):
            details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
            return JSONResponse(status_code=400, content={"error": {"message": "Validation failed", "details": details}})
    `
  );

  if (sql) {
    py(
      file(M.database),
      `
      import logging
      import time
      from typing import Iterator

      from sqlalchemy import create_engine
      from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

      from ${M.config} import settings

      logger = logging.getLogger(__name__)

      engine = create_engine(
          settings.database_url,
          pool_pre_ping=True,
          ${db === "sqlite" ? `connect_args={"check_same_thread": False},` : ""}
      )
      SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


      class Base(DeclarativeBase):
          pass


      def get_db() -> Iterator[Session]:
          """FastAPI dependency: one session per request."""
          db = SessionLocal()
          try:
              yield db
          finally:
              db.close()


      def init_db(retries: int = 10) -> None:
          """Creates tables on startup, retrying while the database container boots.

          Starter approach — switch to Alembic migrations for real schemas.
          """
          import ${M.models}  # noqa: F401  (registers models on Base.metadata)

          for attempt in range(1, retries + 1):
              try:
                  Base.metadata.create_all(bind=engine)
                  logger.info("Database ready")
                  return
              except Exception as exc:  # pragma: no cover
                  if attempt == retries:
                      raise
                  logger.warning("Database not ready (attempt %s): %s", attempt, exc)
                  time.sleep(3)
      `
    );

    py(
      file(M.models),
      `
      import uuid
      from datetime import datetime, timezone

      from sqlalchemy import DateTime, String
      from sqlalchemy.orm import Mapped, mapped_column

      from ${M.database} import Base


      class User(Base):
          __tablename__ = "users"

          id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
          name: Mapped[str] = mapped_column(String(200))
          email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
          created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
      `
    );
  } else {
    py(
      file(M.models),
      `
      import uuid
      from dataclasses import dataclass, field
      from datetime import datetime, timezone


      @dataclass
      class User:
          name: str
          email: str
          id: str = field(default_factory=lambda: str(uuid.uuid4()))
          created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
      `
    );
  }

  py(
    file(M.schemas),
    `
    from datetime import datetime
    from typing import List

    from pydantic import BaseModel, ConfigDict, EmailStr, Field
    from pydantic.alias_generators import to_camel


    class UserCreate(BaseModel):
        name: str = Field(min_length=2, max_length=200)
        email: EmailStr


    class UserOut(BaseModel):
        # Serialised as camelCase (createdAt) to match the frontend.
        model_config = ConfigDict(from_attributes=True, alias_generator=to_camel, populate_by_name=True)

        id: str
        name: str
        email: str
        created_at: datetime


    class UserResponse(BaseModel):
        data: UserOut


    class UserListResponse(BaseModel):
        data: List[UserOut]
    `
  );

  py(
    file(M.repository),
    sql
      ? `
    from typing import List, Optional

    from sqlalchemy import select
    from sqlalchemy.orm import Session

    from ${M.models} import User


    class UserRepository:
        """Data access only — no business rules here."""

        def __init__(self, db: Session):
            self.db = db

        def find_all(self) -> List[User]:
            return list(self.db.scalars(select(User).order_by(User.created_at.desc())))

        def find_by_email(self, email: str) -> Optional[User]:
            return self.db.scalar(select(User).where(User.email == email))

        def create(self, name: str, email: str) -> User:
            user = User(name=name, email=email)
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
            return user
    `
      : `
    from typing import List, Optional

    from ${M.models} import User

    # No database selected: users live in memory and reset on restart.
    _USERS: List[User] = []


    class UserRepository:
        """Data access only — no business rules here."""

        def find_all(self) -> List[User]:
            return sorted(_USERS, key=lambda u: u.created_at, reverse=True)

        def find_by_email(self, email: str) -> Optional[User]:
            return next((u for u in _USERS if u.email == email), None)

        def create(self, name: str, email: str) -> User:
            user = User(name=name, email=email)
            _USERS.append(user)
            return user
    `
  );

  py(
    file(M.service),
    `
    from typing import List

    from ${M.errors} import AppError
    from ${M.models} import User
    from ${M.repository} import UserRepository
    from ${M.schemas} import UserCreate


    class UserService:
        """Business rules live here; routers stay thin and repositories stay dumb."""

        def __init__(self, repository: UserRepository):
            self.repository = repository

        def list_users(self) -> List[User]:
            return self.repository.find_all()

        def create_user(self, data: UserCreate) -> User:
            email = data.email.lower()
            if self.repository.find_by_email(email):
                raise AppError(409, "A user with this email already exists")
            return self.repository.create(name=data.name.strip(), email=email)
    `
  );

  py(
    file(M.router),
    `
    from fastapi import APIRouter, Depends, status
    ${sql ? "from sqlalchemy.orm import Session\n" : ""}
    ${sql ? `from ${M.database} import get_db\n` : ""}from ${M.repository} import UserRepository
    from ${M.schemas} import UserCreate, UserListResponse, UserResponse
    from ${M.service} import UserService

    router = APIRouter(prefix="/users", tags=["users"])


    def get_user_service(${sql ? "db: Session = Depends(get_db)" : ""}) -> UserService:
        """Dependency injection: router → service → repository${sql ? " → session" : ""}."""
        return UserService(UserRepository(${sql ? "db" : ""}))


    @router.get("", response_model=UserListResponse)
    def list_users(service: UserService = Depends(get_user_service)):
        return {"data": service.list_users()}


    @router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
    def create_user(payload: UserCreate, service: UserService = Depends(get_user_service)):
        return {"data": service.create_user(payload)}
    `
  );

  if (!modular) {
    py(
      "app/api/router.py",
      `
      from fastapi import APIRouter

      from app.api.routes import users

      # Every feature router is mounted here, under /api.
      api_router = APIRouter()
      api_router.include_router(users.router)


      @api_router.get("/health", tags=["health"])
      def health():
          return {"data": {"status": "ok"}}
      `
    );
  }

  py(
    "app/main.py",
    `
    import logging
    from contextlib import asynccontextmanager

    from fastapi import ${modular ? "APIRouter, " : ""}FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    from ${M.config} import settings
    from ${M.errors} import register_error_handlers
    ${sql ? `from ${M.database} import init_db\n` : ""}${modular ? `from ${M.router} import router as users_router` : "from app.api.router import api_router"}

    logging.basicConfig(level=logging.INFO)


    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        ${sql ? "init_db()" : "# No database to initialise."}
        yield


    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.client_url],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    ${
      modular
        ? `
    # Every module router is mounted here, under /api.
    api_router = APIRouter(prefix="/api")
    api_router.include_router(users_router)


    @api_router.get("/health", tags=["health"])
    def health():
        return {"data": {"status": "ok"}}


    app.include_router(api_router)`
        : `app.include_router(api_router, prefix="/api")`
    }
    `
  );

  const requirements = [
    PYTHON.fastapi,
    PYTHON.pydanticSettings,
    sql && PYTHON.sqlalchemy,
    db === "postgres" && PYTHON.psycopg,
    db === "mysql" && PYTHON.pymysql,
  ].filter(Boolean);
  py("requirements.txt", requirements.join("\n") + "\n");

  if (ctx.extras.includes("env")) {
    const vars = [
      "ENVIRONMENT=development",
      `CLIENT_URL=http://localhost:${ctx.frontendPort}`,
      sql && `DATABASE_URL=${PY_DB_URLS[db](ctx.dbName)}`,
    ]
      .filter(Boolean)
      .join("\n");
    py(".env.example", vars + "\n");
    py(".env", vars + "\n");
  }

  return {
    flowFiles: [
      ["Router", file(M.router)],
      ["Service", file(M.service)],
      ["Repository", file(M.repository)],
      ["Model", file(M.models)],
    ],
    folders: modular
      ? [
          ["app/modules/users/", "The users module: `router`, `service`, `repository`, `models`, `schemas`."],
          ["app/core/", "Settings, database engine/session, error handling."],
          ["app/main.py", "App factory: CORS, error handlers, routers under `/api`."],
        ]
      : [
          ["app/api/", "Routers (HTTP layer). `router.py` mounts everything under `/api`."],
          ["app/services/", "Business rules."],
          ["app/repositories/", "Data access only."],
          ["app/models/", sql ? "SQLAlchemy ORM models." : "Domain models."],
          ["app/schemas/", "Pydantic request/response schemas."],
          ...(sql ? [["app/db/", "Engine, session dependency and table creation."]] : []),
          ["app/core/", "Settings and error handling."],
        ],
  };
}
