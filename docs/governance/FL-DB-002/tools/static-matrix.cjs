// Offline TypeScript AST inventory. Never evaluates project modules or connects to services.
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const root = path.resolve(process.argv[2]);
const ts = require(path.join(root, "node_modules/typescript"));
const tracked = cp
  .execFileSync("git", ["--no-optional-locks", "ls-files", "-z"], { cwd: root })
  .toString()
  .split("\0")
  .filter(Boolean);
const files = tracked.filter(
  (x) => x.startsWith("src/") && x.endsWith(".ts") && !/\.(spec|test)\.ts$/.test(x),
);
const classes = [],
  modules = [],
  sourceFiles = [];
const decs = (n) => (ts.canHaveDecorators(n) ? ts.getDecorators(n) || [] : []);
const calls = (n) =>
  decs(n)
    .map((d) => d.expression)
    .filter(ts.isCallExpression);
const dname = (d) => d.expression.getText();
const strings = (n) =>
  !n
    ? [""]
    : ts.isStringLiteralLike(n)
      ? [n.text]
      : ts.isArrayLiteralExpression(n)
        ? n.elements.flatMap(strings)
        : ["<dynamic-unresolved>"];
const names = (n) =>
  !n
    ? []
    : ts.isIdentifier(n)
      ? [n.text]
      : ts.isArrayLiteralExpression(n)
        ? n.elements.flatMap(names)
        : ts.isCallExpression(n)
          ? [n.expression.getText().split(".")[0]]
          : [];
const guards = (n) =>
  calls(n)
    .filter((x) => dname(x) === "UseGuards")
    .flatMap((x) =>
      x.arguments.map((a) => a.getText()).filter((x) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(x)),
    );
for (const file of files) {
  const full = path.join(root, file);
  if (fs.lstatSync(full).isSymbolicLink()) throw Error("source_link_rejected");
  const text = fs.readFileSync(full, "utf8"),
    sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  sourceFiles.push({
    path: file,
    sha256: crypto.createHash("sha256").update(text).digest("hex"),
    parseDiagnostics: sf.parseDiagnostics.map((x) => x.code),
  });
  for (const node of sf.statements) {
    if (!ts.isClassDeclaration(node) || !node.name) continue;
    const className = node.name.text,
      ctor = node.members.find(ts.isConstructorDeclaration),
      deps = {};
    for (const p of ctor?.parameters || [])
      if (ts.isIdentifier(p.name) && p.type && ts.isTypeReferenceNode(p.type))
        deps[p.name.text] = p.type.typeName.getText();
    const cls = {
      className,
      file,
      line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      dependencies: deps,
      guards: guards(node),
      methods: [],
    };
    const ctrl = calls(node).find((x) => dname(x) === "Controller");
    if (ctrl) cls.prefixes = strings(ctrl.arguments[0]);
    const mod = calls(node).find((x) => dname(x) === "Module");
    if (mod && mod.arguments[0] && ts.isObjectLiteralExpression(mod.arguments[0])) {
      const rec = { name: className, file, imports: [], controllers: [], providers: [] };
      for (const p of mod.arguments[0].properties)
        if (
          ts.isPropertyAssignment(p) &&
          ["imports", "controllers", "providers"].includes(p.name.getText())
        )
          rec[p.name.getText()] = names(p.initializer);
      modules.push(rec);
    }
    for (const m of node.members) {
      if (!ts.isMethodDeclaration(m) || !m.name) continue;
      const method = m.name.getText(),
        line = sf.getLineAndCharacterOfPosition(m.getStart()).line + 1,
        callTargets = [],
        dbCalls = [],
        identityFields = new Set(),
        fieldSources = [],
        comparisons = [];
      function walk(n) {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
          const expr = n.expression.getText();
          if (/^this\.[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+$/.test(expr)) {
            const parts = expr.split(".");
            if (parts[1] === "prisma") dbCalls.push(parts.slice(2).join("."));
            else if (parts.length === 3 && deps[parts[1]])
              callTargets.push(deps[parts[1]] + "." + parts[2]);
            else if (parts.length === 2) callTargets.push(className + "." + parts[1]);
          } else if (/^this\.[A-Za-z_]\w*$/.test(expr))
            callTargets.push(className + "." + expr.split(".")[1]);
        }
        if (
          ts.isIdentifier(n) &&
          /^(tenantId|userId|customerId|environment|fastlinkAuth|roles|permissions|sessionId)$/.test(
            n.text,
          )
        )
          identityFields.add(n.text);
        if (
          ts.isPropertyAssignment(n) &&
          /^(tenantId|userId|customerId|environment|id)$/.test(n.name.getText())
        ) {
          const raw = n.initializer.getText();
          fieldSources.push({
            field: n.name.getText(),
            source: /^[A-Za-z_$][\w$?.!]*$/.test(raw) ? raw : "<expression-or-literal>",
            line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          });
        }
        if (ts.isBinaryExpression(n) && /tenantId|userId|customerId|environment/.test(n.getText()))
          comparisons.push({
            operator: ts.tokenToString(n.operatorToken.kind) || "unknown",
            line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          });
        ts.forEachChild(n, walk);
      }
      if (m.body) walk(m.body);
      const routes = calls(m)
        .filter((x) =>
          ["Get", "Post", "Put", "Patch", "Delete", "Options", "Head", "All"].includes(dname(x)),
        )
        .flatMap((d) =>
          strings(d.arguments[0]).map((p) => ({ verb: dname(d).toUpperCase(), path: p })),
        );
      const params = m.parameters.map((p) => ({
        name: p.name.getText(),
        bindings: calls(p)
          .filter((d) => ["Param", "Body", "Query", "Req", "Headers"].includes(dname(d)))
          .map((d) => ({ kind: dname(d), keys: strings(d.arguments[0]) })),
      }));
      cls.methods.push({
        method,
        line,
        guards: guards(m),
        routes,
        params,
        callTargets: [...new Set(callTargets)],
        dbCalls: [...new Set(dbCalls)],
        identityFields: [...identityFields],
        fieldSources,
        comparisons,
        proofLevel: "STATIC_ONLY_NOT_RUNTIME_AUTHORIZATION_PROOF",
      });
    }
    classes.push(cls);
  }
}
const moduleMap = new Map(modules.map((x) => [x.name, x])),
  reachableModules = new Set();
function visitModule(n) {
  if (reachableModules.has(n)) return;
  reachableModules.add(n);
  for (const c of moduleMap.get(n)?.imports || []) visitModule(c);
}
visitModule("AppModule");
const registered = new Set(
  modules.filter((m) => reachableModules.has(m.name)).flatMap((m) => m.controllers),
);
const methodMap = new Map();
for (const c of classes)
  for (const m of c.methods) {
    const k = c.className + "." + m.method;
    methodMap.set(k, [...(methodMap.get(k) || []), { class: c, ...m }]);
  }
function reachable(key) {
  const seen = new Set(),
    db = new Set(),
    unresolved = new Set(),
    source = [];
  const queue = [key];
  while (queue.length) {
    const k = queue.pop();
    if (seen.has(k)) continue;
    seen.add(k);
    const matches = methodMap.get(k);
    if (!matches || matches.length !== 1) {
      unresolved.add(k);
      continue;
    }
    const m = matches[0];
    source.push({ symbol: k, file: m.class.file, line: m.line });
    for (const q of m.dbCalls) db.add(q);
    queue.push(...m.callTargets);
  }
  return {
    methods: source,
    databaseCalls: [...db].sort(),
    unresolvedTargets: [...unresolved].sort(),
  };
}
const routes = [];
for (const c of classes.filter((x) => x.prefixes))
  for (const m of c.methods)
    for (const prefix of c.prefixes)
      for (const r of m.routes) {
        routes.push({
          id: "API-" + String(routes.length + 1).padStart(3, "0"),
          file: c.file,
          line: m.line,
          controller: c.className,
          handler: m.method,
          verb: r.verb,
          path: "/api/" + [prefix, r.path].filter(Boolean).join("/"),
          registeredFromAppModule: registered.has(c.className),
          guards: [...new Set([...c.guards, ...m.guards])],
          params: m.params,
          identityFields: m.identityFields,
          fieldSources: m.fieldSources,
          trace: reachable(c.className + "." + m.method),
          localDynamic: "NOT_RUN",
          deployedDynamic: "BLOCKED_UNAUTHORIZED",
        });
      }
const result = {
  sourceHead: cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim(),
  sourceFiles,
  modules,
  controllerCount: classes.filter((x) => x.prefixes).length,
  routes,
  methodEvidence: classes.filter(
    (x) =>
      x.methods.some((m) => m.routes.length) ||
      /Guard|AuthService|SessionService|PrismaService/.test(x.className),
  ),
  limits: [
    "AST coverage of tracked backend src only; route aliases expanded",
    "Custom decorators and dynamic module/provider mappings require manual review",
    "Static call trace follows unambiguous constructor types and this.method; factories, transaction callback DB clients and indirect calls may remain unresolved",
    "Identity field occurrences or static guard presence do not prove runtime isolation",
    "No secret values, function bodies, connection URLs or environment values exported",
  ],
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
