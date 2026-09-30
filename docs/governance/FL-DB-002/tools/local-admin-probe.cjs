"use strict";
// Targeted original Nest HTTP route with synthetic persistence. Never import AppModule or .env.
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  net = require("net"),
  http = require("http");
const { createRequire } = require("module");
const [backend, privateRoot, output] = process.argv.slice(2);
if (!backend || !privateRoot || !output) throw Error("three paths required");
process.umask(0o077);
if ((fs.statSync(privateRoot).mode & 0o777) !== 0o700) throw Error("private root permissions");
for (const k of Object.keys(process.env))
  if (!["PATH", "LANG", "TMPDIR"].includes(k)) delete process.env[k];
const req = createRequire(path.join(backend, "package.json"));
req("reflect-metadata");
const ts = req("typescript");
const loaded = [];
require.extensions[".ts"] = (mod, file) => {
  if (!file.startsWith(backend + "/src/")) throw Error("unexpected source path");
  const raw = fs.readFileSync(file, "utf8");
  loaded.push({
    path: path.relative(backend, file),
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
  });
  mod._compile(
    ts.transpileModule(raw, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
};
let permittedPort = 0,
  attempts = 0;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = typeof first === "object" ? first : { port: first, host: args[1] };
  if (options.host !== "127.0.0.1" || Number(options.port) !== permittedPort || !permittedPort) {
    attempts++;
    throw Error("network target denied");
  }
  return connect.apply(this, args);
};
const { Test } = req("@nestjs/testing"),
  { ConfigService } = req("@nestjs/config"),
  { ValidationPipe } = req("@nestjs/common");
const { TenantsController } = require(backend + "/src/tenants/tenants.controller.ts");
const { TenantsService } = require(backend + "/src/tenants/tenants.service.ts");
const { AdminBearerGuard } = require(backend + "/src/admin-auth/admin-bearer.guard.ts");
const { AdminAuthService } = require(backend + "/src/admin-auth/admin-auth.service.ts");
const { PrismaService } = require(backend + "/src/prisma/prisma.service.ts");
const hash = (x) =>
  crypto
    .createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
let app;
(async () => {
  const started = new Date().toISOString();
  const tokens = [
    crypto.randomBytes(32).toString("base64url"),
    crypto.randomBytes(32).toString("base64url"),
  ];
  const material = path.join(privateRoot, "local-admin-material.json");
  fs.writeFileSync(material, JSON.stringify({ purpose: "FL-DB-002-local-only", tokens }), {
    mode: 0o600,
    flag: "wx",
  });
  const tenants = ["A", "B"].map((s) => ({
    id: "db2-synthetic-tenant-" + s,
    environment: "SANDBOX",
    status: "ACTIVE",
    legalName: "Synthetic " + s,
    brandName: "Synthetic " + s,
    slug: "db2-synthetic-" + s,
    createdAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2000-01-01T00:00:00.000Z",
  }));
  const sessions = tokens.map((t, i) => ({
    id: "db2-session-" + i,
    tokenHash: hash(t),
    revokedAt: null,
    expiresAt: new Date(Date.now() + 600000),
    tenantUser: {
      id: "db2-user-" + i,
      tenantId: tenants[i].id,
      isActive: true,
      tenant: tenants[i],
      roles: [
        { role: { code: "TENANT_ADMIN", permissions: [{ permission: { scope: "admin:read" } }] } },
      ],
    },
  }));
  let sessionTouches = 0;
  const queries = [];
  const prisma = {
    adminSession: {
      findUnique: async (q) => sessions.find((s) => s.tokenHash === q.where.tokenHash) || null,
      update: async () => {
        sessionTouches++;
        return {};
      },
    },
    tenant: {
      findFirst: async (q) => {
        if (Object.keys(q.where).sort().join(",") !== "environment,id")
          throw Error("unexpected database predicate");
        queries.push({
          model: "Tenant",
          predicateKeys: Object.keys(q.where),
          targetTenant:
            q.where.id === tenants[0].id ? "A" : q.where.id === tenants[1].id ? "B" : "UNKNOWN",
        });
        const row = tenants.find((t) => Object.entries(q.where).every(([k, v]) => t[k] === v));
        return row
          ? Object.fromEntries(
              Object.keys(q.select)
                .filter((k) => q.select[k])
                .map((k) => [k, row[k]]),
            )
          : null;
      },
    },
  };
  const before = hash(tenants);
  const module = await Test.createTestingModule({
    controllers: [TenantsController],
    providers: [
      TenantsService,
      AdminBearerGuard,
      AdminAuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: new ConfigService({}) },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  permittedPort = address.port;
  const request = (route, token) =>
    new Promise((resolve, reject) => {
      const r = http.request(
        {
          host: "127.0.0.1",
          port: permittedPort,
          path: route,
          method: "GET",
          headers: token ? { Authorization: "Bearer " + token } : {},
        },
        (res) => {
          let b = "";
          res.on("data", (x) => (b += x));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(b) });
            } catch {
              reject(Error("invalid local response"));
            }
          });
        },
      );
      r.on("error", () => reject(Error("local request failed")));
      r.end();
    });
  const cases = [
    { id: "D01", name: "unauthenticated", tenant: 0, auth: false, expected: 401 },
    { id: "D02", name: "same-tenant-A", tenant: 0, auth: true, expected: 200 },
    { id: "D03", name: "cross-tenant-B-no-override", tenant: 1, auth: true, expected: 403 },
    {
      id: "D04",
      name: "cross-tenant-B-query-conflict",
      tenant: 1,
      auth: true,
      conflict: true,
      expected: 403,
    },
  ];
  const results = [];
  let stopped = false;
  for (const c of cases) {
    const route =
      "/api/admin/tenants/" +
      tenants[c.tenant].id +
      (c.conflict ? "?tenantId=" + tenants[0].id : "");
    const res = await request(route, c.auth ? tokens[0] : null);
    const foreign = res.status === 200 && res.body.id === tenants[1].id;
    results.push({
      id: c.id,
      name: c.name,
      actor: c.auth ? "synthetic-A-tenant-admin" : "anonymous",
      expected: c.expected,
      actual: res.status,
      foreignTenantReturned: foreign,
      status: res.status === c.expected ? "PASS" : "FAIL",
    });
    if (foreign) {
      stopped = true;
      break;
    }
    if (res.status !== c.expected) break;
  }
  await app.close();
  app = null;
  const evidence = {
    schema: "FL-DB-002-local-probe-v1",
    startedAt: started,
    finishedAt: new Date().toISOString(),
    sourceKind: "original controller + guard + service, transpiled in memory",
    persistence: "strict in-memory Prisma boundary mock; no database connection",
    scope: "isolated local behavior, not deployed environment",
    globalPipeline:
      "native Nest routing + actual class guard + ValidationPipe; full AppModule not booted",
    omitted: [
      "global throttler",
      "audit interceptor/filter",
      "read-only interceptor",
      "login issuance",
      "actual Prisma/GRANT/RLS",
    ],
    binding: {
      address: address.address,
      family: address.family,
      ephemeralPort: true,
      serverStopped: true,
    },
    environmentAllowlist: ["PATH", "LANG", "TMPDIR"],
    deniedNetworkAttempts: attempts,
    roles: {
      actor: "TENANT_ADMIN",
      permissions: ["admin:read"],
      platformPermissions: [],
      tenants: 2,
      users: 2,
    },
    cases: results,
    stopOnConfirmedCrossTenant: stopped,
    expandedTestsAfterStop: 0,
    databaseQueries: queries,
    syntheticBusinessData: {
      beforeSha256: before,
      afterSha256: hash(tenants),
      equal: before === hash(tenants),
    },
    syntheticSessionTouches: sessionTouches,
    materials: {
      keyId: "FL-DB-002-local-admin-01",
      fileMode: (fs.statSync(material).mode & 0o777).toString(8),
      parentMode: (fs.statSync(privateRoot).mode & 0o777).toString(8),
      fingerprints: tokens.map(hash),
      retained: true,
      remoteUsability: "none; synthetic sessions only",
      expiry: "10 minutes from generation",
    },
    loadedSources: loaded,
  };
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ cases: results, stopped, serverStopped: true, output }));
})().catch(async () => {
  if (app) await app.close().catch(() => {});
  console.error("FL-DB-002 probe blocked: redacted runtime failure; no exception values printed");
  process.exitCode = 1;
});
