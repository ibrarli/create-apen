// ASP.NET Core Web API generator: layered, vertical slice, or clean architecture.
import { randomUUID } from "node:crypto";
import { toDotnetName } from "../../utils/naming.js";

const SA_PASSWORD = "Apen_Str0ng!Passw0rd";

export const DOTNET_CONNECTION = {
  postgres: (db, host = "localhost") => `Host=${host};Port=5432;Database=${db};Username=postgres;Password=postgres`,
  sqlserver: (db, host = "localhost") => `Server=${host},1433;Database=${db};User Id=sa;Password=${SA_PASSWORD};TrustServerCertificate=True`,
  mongodb: (_db, host = "localhost") => `mongodb://${host}:27017`,
};
export { SA_PASSWORD };

// Data-access snippets per database. `r` is the receiver (DbContext, collection or store).
const DATA = {
  ef: {
    list: (r) => `await ${r}.Users.AsNoTracking().OrderByDescending(u => u.CreatedAt).ToListAsync(ct)`,
    byEmail: (r) => `await ${r}.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email, ct)`,
    add: (r) => `${r}.Users.Add(user);\n        await ${r}.SaveChangesAsync(ct);`,
  },
  mongodb: {
    list: (r) => `await ${r}.Find(FilterDefinition<User>.Empty).SortByDescending(u => u.CreatedAt).ToListAsync(ct)`,
    byEmail: (r) => `await ${r}.Find(u => u.Email == email).FirstOrDefaultAsync(ct)`,
    add: (r) => `await ${r}.InsertOneAsync(user, cancellationToken: ct);`,
  },
  none: {
    list: (r) => `${r}.All()`,
    byEmail: (r) => `${r}.FindByEmail(email)`,
    add: (r) => `${r}.Add(user);`,
  },
};

export function generateDotnet(ctx) {
  const { project, prefix, be } = ctx;
  const N = toDotnetName(ctx.packageName);
  const major = ctx.dotnetMajor;
  const tfm = `net${major}.0`;
  const db = be.database;
  const ef = db === "postgres" || db === "sqlserver";
  const data = DATA[ef ? "ef" : db];
  const arch = be.architecture;
  const cs = (rel, code) => project.add(prefix + rel, code);
  const apiProject = `${N}.Api`;
  const apiDir = `src/${apiProject}`;
  const projects = [];

  const efPackage = db === "postgres" ? "Npgsql.EntityFrameworkCore.PostgreSQL" : "Microsoft.EntityFrameworkCore.SqlServer";
  const useDb = db === "postgres" ? "UseNpgsql" : "UseSqlServer";
  const dbPackages = ef ? [[efPackage, `${major}.*`]] : db === "mongodb" ? [["MongoDB.Driver", "3.*"]] : [];

  const csproj = ({ sdk = "Microsoft.NET.Sdk", packages = [], refs = [], frameworkRef = false }) => `
    <Project Sdk="${sdk}">

      <PropertyGroup>
        <TargetFramework>${tfm}</TargetFramework>
        <Nullable>enable</Nullable>
        <ImplicitUsings>enable</ImplicitUsings>
      </PropertyGroup>
    ${
      packages.length
        ? `
      <ItemGroup>
    ${packages.map(([name, v]) => `    <PackageReference Include="${name}" Version="${v}" />`).join("\n")}
      </ItemGroup>
    `
        : ""
    }${
      refs.length
        ? `
      <ItemGroup>
    ${refs.map((r) => `    <ProjectReference Include="..\\${r}\\${r}.csproj" />`).join("\n")}
      </ItemGroup>
    `
        : ""
    }${
      frameworkRef
        ? `
      <ItemGroup>
        <FrameworkReference Include="Microsoft.AspNetCore.App" />
      </ItemGroup>

      <ItemGroup>
        <Using Include="Microsoft.AspNetCore.Http" />
        <Using Include="Microsoft.Extensions.Configuration" />
        <Using Include="Microsoft.Extensions.DependencyInjection" />
        <Using Include="Microsoft.Extensions.Logging" />
      </ItemGroup>
    `
        : ""
    }
    </Project>
    `;

  // ── namespaces per architecture ─────────────────────────
  const ns =
    arch === "clean"
      ? {
          entity: `${N}.Domain.Entities`,
          repoContract: `${N}.Domain.Repositories`,
          dtos: `${N}.Application.Users`,
          service: `${N}.Application.Users`,
          errors: `${N}.Application.Common`,
          data: `${N}.Infrastructure.Persistence`,
          repo: `${N}.Infrastructure.Repositories`,
          controllers: `${apiProject}.Controllers`,
          middleware: `${apiProject}.Middleware`,
        }
      : arch === "layered"
        ? {
            entity: `${apiProject}.Models`,
            repoContract: `${apiProject}.Repositories`,
            dtos: `${apiProject}.DTOs`,
            service: `${apiProject}.Services`,
            errors: `${apiProject}.Exceptions`,
            data: `${apiProject}.Data`,
            repo: `${apiProject}.Repositories`,
            controllers: `${apiProject}.Controllers`,
            middleware: `${apiProject}.Middleware`,
          }
        : {
            entity: `${apiProject}.Features.Users`,
            dtos: `${apiProject}.Features.Users`,
            errors: `${apiProject}.Common.Errors`,
            data: `${apiProject}.Common.Data`,
            middleware: `${apiProject}.Common.Errors`,
          };

  const paths =
    arch === "clean"
      ? {
          entity: `src/${N}.Domain/Entities/User.cs`,
          repoContract: `src/${N}.Domain/Repositories/IUserRepository.cs`,
          errors: `src/${N}.Application/Common/AppException.cs`,
          dtos: `src/${N}.Application/Users/UserDtos.cs`,
          serviceContract: `src/${N}.Application/Users/IUserService.cs`,
          service: `src/${N}.Application/Users/UserService.cs`,
          data: `src/${N}.Infrastructure/Persistence`,
          repo: `src/${N}.Infrastructure/Repositories/UserRepository.cs`,
          controllers: `${apiDir}/Controllers/UsersController.cs`,
          middleware: `${apiDir}/Middleware/GlobalExceptionHandler.cs`,
        }
      : arch === "layered"
        ? {
            entity: `${apiDir}/Models/User.cs`,
            repoContract: `${apiDir}/Repositories/IUserRepository.cs`,
            errors: `${apiDir}/Exceptions/AppException.cs`,
            dtos: `${apiDir}/DTOs/UserDtos.cs`,
            serviceContract: `${apiDir}/Services/IUserService.cs`,
            service: `${apiDir}/Services/UserService.cs`,
            data: `${apiDir}/Data`,
            repo: `${apiDir}/Repositories/UserRepository.cs`,
            controllers: `${apiDir}/Controllers/UsersController.cs`,
            middleware: `${apiDir}/Middleware/GlobalExceptionHandler.cs`,
          }
        : {
            entity: `${apiDir}/Features/Users/User.cs`,
            dtos: `${apiDir}/Features/Users/UserDtos.cs`,
            errors: `${apiDir}/Common/Errors/AppException.cs`,
            data: `${apiDir}/Common/Data`,
            middleware: `${apiDir}/Common/Errors/GlobalExceptionHandler.cs`,
          };

  // ── entity ──────────────────────────────────────────────
  cs(
    paths.entity,
    `
    namespace ${ns.entity};

    public class User
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public required string Name { get; set; }
        public required string Email { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
    `
  );

  // ── errors ──────────────────────────────────────────────
  cs(
    paths.errors,
    `
    namespace ${ns.errors};

    /// <summary>An error that maps to an HTTP status code. Rendered by GlobalExceptionHandler.</summary>
    public class AppException(int statusCode, string message) : Exception(message)
    {
        public int StatusCode { get; } = statusCode;
    }
    `
  );

  cs(
    paths.middleware,
    `
    using Microsoft.AspNetCore.Diagnostics;
    ${ns.errors !== ns.middleware ? `using ${ns.errors};\n` : ""}
    namespace ${ns.middleware};

    /// <summary>Turns every unhandled exception into { "error": { "message": ... } }.</summary>
    public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment env) : IExceptionHandler
    {
        public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
        {
            var (status, message) = exception switch
            {
                AppException app => (app.StatusCode, app.Message),
                _ => (StatusCodes.Status500InternalServerError, env.IsDevelopment() ? exception.Message : "Internal server error"),
            };
            if (status >= 500) logger.LogError(exception, "Unhandled exception");

            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new { error = new { message } }, ct);
            return true;
        }
    }
    `
  );

  // ── DTOs ────────────────────────────────────────────────
  cs(
    paths.dtos,
    `
    using System.ComponentModel.DataAnnotations;
    ${ns.entity !== ns.dtos ? `using ${ns.entity};\n` : ""}
    namespace ${ns.dtos};

    public record CreateUserRequest(
        [Required, MinLength(2)] string Name,
        [Required, EmailAddress] string Email);

    public record UserResponse(string Id, string Name, string Email, DateTime CreatedAt)
    {
        public static UserResponse From(User user) => new(user.Id, user.Name, user.Email, user.CreatedAt);
    }
    `
  );

  // ── persistence ─────────────────────────────────────────
  const dataUsings = [ns.entity !== ns.data && `using ${ns.entity};`].filter(Boolean).join("\n");
  if (ef) {
    cs(
      `${paths.data}/AppDbContext.cs`,
      `
      using Microsoft.EntityFrameworkCore;
      ${dataUsings}

      namespace ${ns.data};

      public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
      {
          public DbSet<User> Users => Set<User>();

          protected override void OnModelCreating(ModelBuilder modelBuilder)
          {
              modelBuilder.Entity<User>(user =>
              {
                  user.HasKey(u => u.Id);
                  user.Property(u => u.Name).HasMaxLength(200);
                  user.Property(u => u.Email).HasMaxLength(320);
                  user.HasIndex(u => u.Email).IsUnique();
              });
          }
      }
      `
    );
  } else if (db === "mongodb") {
    cs(
      `${paths.data}/MongoDbContext.cs`,
      `
      using MongoDB.Driver;
      ${dataUsings}

      namespace ${ns.data};

      /// <summary>Exposes MongoDB collections. "Id" is mapped to _id by the driver's conventions.</summary>
      public class MongoDbContext(IMongoClient client, IConfiguration configuration)
      {
          private readonly IMongoDatabase _database = client.GetDatabase(configuration["Database:Name"] ?? "${ctx.dbName}");

          public IMongoCollection<User> Users => _database.GetCollection<User>("users");
      }
      `
    );
  } else {
    cs(
      `${paths.data}/InMemoryUserStore.cs`,
      `
      using System.Collections.Concurrent;
      ${dataUsings}

      namespace ${ns.data};

      /// <summary>No database selected: users live in memory and reset on restart.</summary>
      public class InMemoryUserStore
      {
          private readonly ConcurrentDictionary<string, User> _users = new();

          public List<User> All() => _users.Values.OrderByDescending(u => u.CreatedAt).ToList();

          public User? FindByEmail(string email) => _users.Values.FirstOrDefault(u => u.Email == email);

          public void Add(User user) => _users[user.Id] = user;
      }
      `
    );
  }

  cs(
    `${paths.data}/DatabaseInitializer.cs`,
    `
    ${ef ? "using Microsoft.EntityFrameworkCore;\n" : ""}${db === "mongodb" ? "using MongoDB.Driver;\n" : ""}${dataUsings}

    namespace ${ns.data};

    public static class DatabaseInitializer
    {
        /// <summary>Creates the schema on startup, retrying while the database container boots.</summary>
        public static async Task InitializeDatabaseAsync(this IServiceProvider services)
        {
            ${
              db === "none"
                ? "await Task.CompletedTask;"
                : `using var scope = services.CreateScope();
            var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Database");
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    ${
                      ef
                        ? `// Starter approach. Switch to EF Core migrations (dotnet ef migrations add Init) for real schemas.
                    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreatedAsync();`
                        : `var users = scope.ServiceProvider.GetRequiredService<MongoDbContext>().Users;
                    await users.Indexes.CreateOneAsync(new CreateIndexModel<User>(
                        Builders<User>.IndexKeys.Ascending(u => u.Email), new CreateIndexOptions { Unique = true }));`
                    }
                    logger.LogInformation("Database ready");
                    return;
                }
                catch (Exception ex) when (attempt < 10)
                {
                    logger.LogWarning("Database not ready (attempt {Attempt}): {Message}", attempt, ex.Message);
                    await Task.Delay(TimeSpan.FromSeconds(3));
                }
            }`
            }
        }
    }
    `
  );

  // Registers the data layer in DI.
  const dataRegistration = (config = "builder.Configuration", services = "builder.Services") =>
    ef
      ? `${services}.AddDbContext<AppDbContext>(options => options.${useDb}(${config}.GetConnectionString("Default")));`
      : db === "mongodb"
        ? `${services}.AddSingleton<IMongoClient>(_ => new MongoClient(${config}.GetConnectionString("Default")));\n${services}.AddSingleton<MongoDbContext>();`
        : `${services}.AddSingleton<InMemoryUserStore>();`;
  const receiverType = ef ? "AppDbContext" : db === "mongodb" ? "MongoDbContext" : "InMemoryUserStore";
  const receiver = (name) => (db === "mongodb" ? `${name}.Users` : name);
  const asyncList = ef || db === "mongodb";

  // ── repository + service (layered / clean) ──────────────
  if (arch !== "vertical") {
    cs(
      paths.repoContract,
      `
      ${ns.entity !== ns.repoContract ? `using ${ns.entity};\n` : ""}
      namespace ${ns.repoContract};

      public interface IUserRepository
      {
          Task<List<User>> GetAllAsync(CancellationToken ct = default);
          Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
          Task AddAsync(User user, CancellationToken ct = default);
      }
      `
    );

    const repoUsings = [
      ef && "using Microsoft.EntityFrameworkCore;",
      db === "mongodb" && "using MongoDB.Driver;",
      `using ${ns.entity};`,
      ns.repoContract !== ns.repo && `using ${ns.repoContract};`,
      `using ${ns.data};`,
    ]
      .filter(Boolean)
      .join("\n");
    const r = receiver("store");
    cs(
      paths.repo,
      `
      ${repoUsings}

      namespace ${ns.repo};

      /// <summary>Data access only — no business rules here.</summary>
      public class UserRepository(${receiverType} store) : IUserRepository
      {
          public ${asyncList ? "async " : ""}Task<List<User>> GetAllAsync(CancellationToken ct = default) =>
              ${asyncList ? data.list(r) : `Task.FromResult(${data.list(r)})`};

          public ${asyncList ? "async " : ""}Task<User?> GetByEmailAsync(string email, CancellationToken ct = default) =>
              ${asyncList ? data.byEmail(r) : `Task.FromResult(${data.byEmail(r)})`};

          public ${asyncList ? "async " : ""}Task AddAsync(User user, CancellationToken ct = default)
          {
              ${data.add(r).replace(/\n\s*/g, "\n            ")}${asyncList ? "" : "\n            return Task.CompletedTask;"}
          }
      }
      `
    );

    cs(
      paths.serviceContract,
      `
      ${ns.dtos !== ns.service ? `using ${ns.dtos};\n` : ""}
      namespace ${ns.service};

      public interface IUserService
      {
          Task<List<UserResponse>> ListAsync(CancellationToken ct = default);
          Task<UserResponse> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
      }
      `
    );

    const svcUsings = [
      `using ${ns.entity};`,
      ns.repoContract !== ns.service && `using ${ns.repoContract};`,
      ns.dtos !== ns.service && `using ${ns.dtos};`,
      ns.errors !== ns.service && `using ${ns.errors};`,
    ]
      .filter(Boolean)
      .join("\n");
    cs(
      paths.service,
      `
      ${svcUsings}

      namespace ${ns.service};

      /// <summary>Business rules live here; controllers stay thin and repositories stay dumb.</summary>
      public class UserService(IUserRepository users) : IUserService
      {
          public async Task<List<UserResponse>> ListAsync(CancellationToken ct = default) =>
              (await users.GetAllAsync(ct)).Select(UserResponse.From).ToList();

          public async Task<UserResponse> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
          {
              var email = request.Email.Trim().ToLowerInvariant();
              if (await users.GetByEmailAsync(email, ct) is not null)
                  throw new AppException(StatusCodes.Status409Conflict, "A user with this email already exists");

              var user = new User { Name = request.Name.Trim(), Email = email };
              await users.AddAsync(user, ct);
              return UserResponse.From(user);
          }
      }
      `
    );

    cs(
      paths.controllers,
      `
      using Microsoft.AspNetCore.Mvc;
      using ${ns.service};
      ${ns.dtos !== ns.service ? `using ${ns.dtos};\n` : ""}
      namespace ${ns.controllers};

      /// <summary>Translates HTTP ⇄ service calls. Responses are wrapped as { "data": ... }.</summary>
      [ApiController]
      [Route("api/[controller]")]
      public class UsersController(IUserService users) : ControllerBase
      {
          [HttpGet]
          public async Task<IActionResult> List(CancellationToken ct) =>
              Ok(new { data = await users.ListAsync(ct) });

          [HttpPost]
          public async Task<IActionResult> Create(CreateUserRequest request, CancellationToken ct)
          {
              var user = await users.CreateAsync(request, ct);
              return StatusCode(StatusCodes.Status201Created, new { data = user });
          }
      }
      `
    );
  } else {
    // ── vertical slice: one file per use case + endpoint group ──
    const usings = [ef && "using Microsoft.EntityFrameworkCore;", db === "mongodb" && "using MongoDB.Driver;", `using ${ns.data};`, `using ${ns.errors};`]
      .filter(Boolean)
      .join("\n");
    const r = receiver("store");
    cs(
      `${apiDir}/Features/Users/ListUsers.cs`,
      `
      ${usings}

      namespace ${ns.entity};

      public static class ListUsers
      {
          public static async Task<IResult> Handle(${receiverType} store, CancellationToken ct)
          {
              ${asyncList ? "" : "await Task.CompletedTask;\n        "}var users = ${data.list(r)};
              return Results.Ok(new { data = users.Select(UserResponse.From) });
          }
      }
      `
    );
    cs(
      `${apiDir}/Features/Users/CreateUser.cs`,
      `
      using System.Net.Mail;
      ${usings}

      namespace ${ns.entity};

      public static class CreateUser
      {
          public static async Task<IResult> Handle(CreateUserRequest request, ${receiverType} store, CancellationToken ct)
          {
              if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length < 2)
                  throw new AppException(StatusCodes.Status400BadRequest, "Name must be at least 2 characters");
              if (!MailAddress.TryCreate(request.Email, out _))
                  throw new AppException(StatusCodes.Status400BadRequest, "A valid email is required");

              var email = request.Email.Trim().ToLowerInvariant();
              if (${data.byEmail(r)} is not null)
                  throw new AppException(StatusCodes.Status409Conflict, "A user with this email already exists");

              var user = new User { Name = request.Name.Trim(), Email = email };
              ${data.add(r).replace(/\n\s*/g, "\n        ")}${asyncList ? "" : "\n        await Task.CompletedTask;"}
              return Results.Created($"/api/users/{user.Id}", new { data = UserResponse.From(user) });
          }
      }
      `
    );
    cs(
      `${apiDir}/Features/Users/UserEndpoints.cs`,
      `
      namespace ${ns.entity};

      /// <summary>All HTTP endpoints of the Users slice.</summary>
      public static class UserEndpoints
      {
          public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
          {
              var group = app.MapGroup("/api/users").WithTags("Users");
              group.MapGet("/", ListUsers.Handle);
              group.MapPost("/", CreateUser.Handle);
              return app;
          }
      }
      `
    );
  }

  // ── Program.cs + DI ─────────────────────────────────────
  const cors = `builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
        policy.WithOrigins(builder.Configuration["ClientUrl"] ?? "http://localhost:${ctx.frontendPort}").AllowAnyHeader().AllowAnyMethod()));`;
  const invalidModel = `.ConfigureApiBehaviorOptions(options =>
        options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(new
        {
            error = new
            {
                message = "Validation failed",
                details = context.ModelState.Where(e => e.Value?.Errors.Count > 0)
                    .ToDictionary(e => e.Key, e => e.Value!.Errors.Select(x => x.ErrorMessage)),
            },
        }))`;

  if (arch === "clean") {
    cs(
      `src/${N}.Application/DependencyInjection.cs`,
      `
      using ${ns.service};

      namespace ${N}.Application;

      public static class DependencyInjection
      {
          public static IServiceCollection AddApplication(this IServiceCollection services)
          {
              services.AddScoped<IUserService, UserService>();
              return services;
          }
      }
      `
    );
    cs(
      `src/${N}.Infrastructure/DependencyInjection.cs`,
      `
      ${ef ? "using Microsoft.EntityFrameworkCore;\n" : ""}${db === "mongodb" ? "using MongoDB.Driver;\n" : ""}using ${ns.repoContract};
      using ${ns.data};
      using ${ns.repo};

      namespace ${N}.Infrastructure;

      public static class DependencyInjection
      {
          public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
          {
              ${dataRegistration("configuration", "services").replace(/\n/g, "\n        ")}
              services.AddScoped<IUserRepository, UserRepository>();
              return services;
          }
      }
      `
    );
  }

  const programUsings =
    arch === "clean"
      ? ["using Microsoft.AspNetCore.Mvc;", `using ${N}.Application;`, `using ${N}.Infrastructure;`, `using ${ns.data};`, `using ${ns.middleware};`]
      : arch === "layered"
        ? [
            "using Microsoft.AspNetCore.Mvc;",
            ef && "using Microsoft.EntityFrameworkCore;",
            db === "mongodb" && "using MongoDB.Driver;",
            `using ${ns.data};`,
            `using ${ns.middleware};`,
            `using ${ns.repo};`,
            `using ${ns.service};`,
          ]
        : [
            ef && "using Microsoft.EntityFrameworkCore;",
            db === "mongodb" && "using MongoDB.Driver;",
            `using ${ns.data};`,
            `using ${ns.errors};`,
            `using ${ns.entity};`,
          ];

  const services =
    arch === "clean"
      ? `builder.Services.AddControllers()${invalidModel};
    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);`
      : arch === "layered"
        ? `builder.Services.AddControllers()${invalidModel};
    ${dataRegistration()}
    builder.Services.AddScoped<IUserRepository, UserRepository>();
    builder.Services.AddScoped<IUserService, UserService>();`
        : `${dataRegistration()}`;

  cs(
    `${apiDir}/Program.cs`,
    `
    ${programUsings.filter(Boolean).join("\n")}

    var builder = WebApplication.CreateBuilder(args);

    ${services}
    builder.Services.AddOpenApi();
    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
    builder.Services.AddProblemDetails();
    ${cors}

    var app = builder.Build();

    app.UseExceptionHandler();
    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi(); // OpenAPI document at /openapi/v1.json
    }
    app.UseCors();

    app.MapGet("/api/health", () => Results.Ok(new { data = new { status = "ok" } }));
    ${arch === "vertical" ? "app.MapUserEndpoints();" : "app.MapControllers();"}

    await app.Services.InitializeDatabaseAsync();
    app.Run();
    `
  );

  // ── projects & solution ─────────────────────────────────
  const openApi = [["Microsoft.AspNetCore.OpenApi", `${major}.*`]];
  if (arch === "clean") {
    cs(`src/${N}.Domain/${N}.Domain.csproj`, csproj({}));
    cs(`src/${N}.Application/${N}.Application.csproj`, csproj({ refs: [`${N}.Domain`], frameworkRef: true }));
    cs(`src/${N}.Infrastructure/${N}.Infrastructure.csproj`, csproj({ refs: [`${N}.Application`, `${N}.Domain`], packages: dbPackages, frameworkRef: true }));
    cs(`${apiDir}/${apiProject}.csproj`, csproj({ sdk: "Microsoft.NET.Sdk.Web", packages: openApi, refs: [`${N}.Application`, `${N}.Infrastructure`] }));
    projects.push(`${N}.Domain`, `${N}.Application`, `${N}.Infrastructure`, apiProject);
  } else {
    cs(`${apiDir}/${apiProject}.csproj`, csproj({ sdk: "Microsoft.NET.Sdk.Web", packages: [...openApi, ...dbPackages] }));
    projects.push(apiProject);
  }

  cs(`${N}.sln`, solution(projects));

  const connection = db === "none" ? null : DOTNET_CONNECTION[db](ctx.dbName);
  cs(
    `${apiDir}/appsettings.json`,
    JSON.stringify(
      {
        Logging: { LogLevel: { Default: "Information", "Microsoft.AspNetCore": "Warning" } },
        AllowedHosts: "*",
        ClientUrl: `http://localhost:${ctx.frontendPort}`,
        ...(connection && { ConnectionStrings: { Default: connection } }),
        ...(db === "mongodb" && { Database: { Name: ctx.dbName } }),
      },
      null,
      2
    ) + "\n"
  );
  cs(`${apiDir}/appsettings.Development.json`, JSON.stringify({ Logging: { LogLevel: { Default: "Information", "Microsoft.AspNetCore": "Warning" } } }, null, 2) + "\n");
  cs(
    `${apiDir}/Properties/launchSettings.json`,
    JSON.stringify(
      {
        $schema: "https://json.schemastore.org/launchsettings.json",
        profiles: {
          http: {
            commandName: "Project",
            dotnetRunMessages: true,
            launchBrowser: false,
            applicationUrl: `http://localhost:${ctx.apiPort}`,
            environmentVariables: { ASPNETCORE_ENVIRONMENT: "Development" },
          },
        },
      },
      null,
      2
    ) + "\n"
  );
  cs(
    `${apiDir}/${apiProject}.http`,
    `
    @Api = http://localhost:${ctx.apiPort}

    GET {{Api}}/api/health

    ###

    GET {{Api}}/api/users

    ###

    POST {{Api}}/api/users
    Content-Type: application/json

    { "name": "Ada Lovelace", "email": "ada@example.com" }
    `
  );

  return {
    N,
    apiProject,
    apiDir,
    projects,
    flowFiles:
      arch === "vertical"
        ? [
            ["Endpoints", `${apiDir}/Features/Users/UserEndpoints.cs`],
            ["Handler", `${apiDir}/Features/Users/CreateUser.cs`],
            ["Data", `${paths.data}/${ef ? "AppDbContext" : db === "mongodb" ? "MongoDbContext" : "InMemoryUserStore"}.cs`],
          ]
        : [
            ["Controller", paths.controllers],
            ["Service", paths.service],
            ["Repository", paths.repo],
            ["Data", `${paths.data}/${ef ? "AppDbContext" : db === "mongodb" ? "MongoDbContext" : "InMemoryUserStore"}.cs`],
          ],
    folders:
      arch === "clean"
        ? [
            [`src/${N}.Domain/`, "Entities and repository interfaces. Depends on nothing."],
            [`src/${N}.Application/`, "Use cases (`UserService`), DTOs, application errors. Depends on Domain."],
            [`src/${N}.Infrastructure/`, "EF Core / MongoDB / in-memory persistence and repository implementations."],
            [`${apiDir}/`, "ASP.NET Core host: controllers, middleware, `Program.cs` (composition root)."],
          ]
        : arch === "layered"
          ? [
              [`${apiDir}/Controllers/`, "HTTP endpoints — thin, call services."],
              [`${apiDir}/Services/`, "Business rules."],
              [`${apiDir}/Repositories/`, "Data access behind `IUserRepository`."],
              [`${apiDir}/Data/`, "DbContext / database client and startup initialisation."],
              [`${apiDir}/Models/`, "Entities."],
              [`${apiDir}/DTOs/`, "Request/response contracts with validation attributes."],
              [`${apiDir}/Middleware/`, "Global exception handler → `{ error: { message } }`."],
              [`${apiDir}/Exceptions/`, "`AppException` (carries an HTTP status)."],
            ]
          : [
              [`${apiDir}/Features/Users/`, "The Users slice: entity, DTOs, one handler per use case, endpoint mapping."],
              [`${apiDir}/Common/Data/`, "Shared persistence (DbContext / client) and initialisation."],
              [`${apiDir}/Common/Errors/`, "`AppException` + global exception handler."],
            ],
  };
}

function solution(projects) {
  const CSHARP = "FAE04EC0-301F-11D3-BF4B-00C04F79EFBC";
  const FOLDER = "2150E333-8FDC-42A3-9474-1A3956D46DE8";
  const srcId = randomUUID().toUpperCase();
  const ids = projects.map(() => randomUUID().toUpperCase());
  const lines = [
    "",
    "Microsoft Visual Studio Solution File, Format Version 12.00",
    "# Visual Studio Version 17",
    "VisualStudioVersion = 17.0.31903.59",
    "MinimumVisualStudioVersion = 10.0.40219.1",
    `Project("{${FOLDER}}") = "src", "src", "{${srcId}}"`,
    "EndProject",
    ...projects.flatMap((p, i) => [`Project("{${CSHARP}}") = "${p}", "src\\${p}\\${p}.csproj", "{${ids[i]}}"`, "EndProject"]),
    "Global",
    "\tGlobalSection(SolutionConfigurationPlatforms) = preSolution",
    "\t\tDebug|Any CPU = Debug|Any CPU",
    "\t\tRelease|Any CPU = Release|Any CPU",
    "\tEndGlobalSection",
    "\tGlobalSection(ProjectConfigurationPlatforms) = postSolution",
    ...ids.flatMap((id) => [
      `\t\t{${id}}.Debug|Any CPU.ActiveCfg = Debug|Any CPU`,
      `\t\t{${id}}.Debug|Any CPU.Build.0 = Debug|Any CPU`,
      `\t\t{${id}}.Release|Any CPU.ActiveCfg = Release|Any CPU`,
      `\t\t{${id}}.Release|Any CPU.Build.0 = Release|Any CPU`,
    ]),
    "\tEndGlobalSection",
    "\tGlobalSection(NestedProjects) = preSolution",
    ...ids.map((id) => `\t\t{${id}} = {${srcId}}`),
    "\tEndGlobalSection",
    "EndGlobal",
    "",
  ];
  return lines.join("\r\n");
}
