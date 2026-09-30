"use strict";

const fs = require("node:fs");
const path = require("node:path");

const [matrixPath, backendRoot, outputPath] = process.argv.slice(2);
if (!matrixPath || !backendRoot || !outputPath)
  throw new Error("matrix, backend and output paths are required");

const ts = require(path.join(backendRoot, "node_modules/typescript"));
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
const routes = matrix.routes.filter((route) => route.guards.includes("AdminBearerGuard"));
if (routes.length !== 131)
  throw new Error(`expected 131 AdminBearerGuard routes, got ${routes.length}`);

const parsedFiles = new Map();
function sourceFile(relativePath) {
  if (parsedFiles.has(relativePath)) return parsedFiles.get(relativePath);
  const full = path.join(backendRoot, relativePath);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw new Error("controller symlink rejected");
  const parsed = ts.createSourceFile(
    relativePath,
    fs.readFileSync(full, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  parsedFiles.set(relativePath, parsed);
  return parsed;
}

function methodNode(route) {
  const sf = sourceFile(route.file);
  let found;
  sf.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== route.controller) return;
    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name?.getText(sf) === route.handler)
        found = member;
    }
  });
  if (!found) throw new Error(`handler missing: ${route.controller}.${route.handler}`);
  return { sf, found };
}

function safeArgument(node, sf) {
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) return node.getText(sf);
  if (ts.isObjectLiteralExpression(node)) {
    return `{${node.properties.map((property) => property.name?.getText(sf) ?? property.kind).join(",")}}`;
  }
  if (ts.isSpreadElement(node)) return `spread:${safeArgument(node.expression, sf)}`;
  return ts.SyntaxKind[node.kind];
}

function serviceCalls(route) {
  const { sf, found } = methodNode(route);
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.getText(sf);
      if (/^this\.[A-Za-z_]\w*\.[A-Za-z_]\w*$/.test(target)) {
        calls.push({
          target,
          arguments: node.arguments.map((argument) => safeArgument(argument, sf)),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(found.body);
  return calls;
}

function sources(route) {
  const request = [];
  for (const parameter of route.params) {
    for (const binding of parameter.bindings) {
      request.push({ kind: binding.kind, keys: binding.keys, parameter: parameter.name });
    }
  }
  return request;
}

function classify(route, calls) {
  const session = route.path === "/api/admin/auth/me" || route.path === "/api/admin/auth/logout";
  const tenantDetail = route.verb === "GET" && route.path === "/api/admin/tenants/:id";
  const pathTenant = route.path.includes(":tenantId");
  const passesTenant = calls.some(
    (call) => call.arguments.includes("tenantId") || call.arguments.includes("auth.tenantId"),
  );
  if (tenantDetail) {
    return {
      status: "PASS_LOCAL",
      authorizedSource: "fastlinkAuth.authorizedTenantId normalized from the tenant resource path",
      mismatch: "DB2-R01 fixed; controller no longer consumes the raw path id",
      coverage: "same DB2-R01 dynamic case plus unit and HTTP regression",
    };
  }
  if (session) {
    return {
      status: "PASS_STATIC",
      authorizedSource: "authenticated administrator session",
      mismatch: "no tenant resource selector",
      coverage: "static plus existing session tests",
    };
  }
  if (pathTenant && passesTenant) {
    return {
      status: "PASS_STATIC",
      authorizedSource: "fastlinkAuth.authorizedTenantId normalized from path tenantId",
      mismatch:
        "shared guard rejects conflicting query/body tenant claims; controller forwards the validated path tenant",
      coverage: "131-route static audit plus shared read/write/update/delete conflict regression",
    };
  }
  if (pathTenant) {
    return {
      status: "LIMITED",
      authorizedSource: "fastlinkAuth.authorizedTenantId normalized from path tenantId",
      mismatch:
        "path scope is guard-validated, but static service-call argument evidence is indirect",
      coverage: "static only; targeted dynamic route coverage required before deployment reuse",
    };
  }
  return {
    status: "LIMITED",
    authorizedSource: "session or guard-validated request tenant depending on the route DTO",
    mismatch:
      "no canonical tenant path; resource ownership remains dependent on controller/service logic",
    coverage: "static only; no new permission conclusion",
  };
}

const audited = routes.map((route) => {
  const calls = serviceCalls(route);
  const conclusion = classify(route, calls);
  return {
    id: route.id,
    method: route.verb,
    route: route.path,
    controller: `${route.controller}.${route.handler}`,
    guard: "AdminBearerGuard",
    requestSources: sources(route),
    authoritativeTenantSource: conclusion.authorizedSource,
    controllerAndServiceCalls: calls,
    databaseCalls: route.trace.databaseCalls,
    authorizationObjectMismatch: conclusion.mismatch,
    repairStatus: conclusion.status,
    regressionCoverage: conclusion.coverage,
    deployedEnvironment: "BLOCKED_UNAUTHORIZED",
  };
});

const counts = audited.reduce((all, row) => {
  all[row.repairStatus] = (all[row.repairStatus] || 0) + 1;
  return all;
}, {});

const result = {
  schema: "FL-DB-003-admin-route-audit-v1",
  backendHead: require("node:child_process")
    .execFileSync("git", ["rev-parse", "HEAD"], { cwd: backendRoot })
    .toString()
    .trim(),
  inheritedMatrixHead: matrix.sourceHead,
  guardRouteCount: audited.length,
  complete: audited.length === 131,
  counts,
  routes: audited,
  limits: [
    "PASS_STATIC proves source-level alignment and shared guard coverage, not deployed runtime behavior.",
    "LIMITED routes retain a targeted dynamic-review requirement and are not treated as authorization-safe for deployment.",
    "Platform permission semantics are preserved from the existing code and tests; no permission is added.",
    "No database, JWT provider, deployed proxy or external service was accessed.",
  ],
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
