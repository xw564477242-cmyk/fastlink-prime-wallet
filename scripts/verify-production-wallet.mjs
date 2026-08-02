import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const sourceRoot = fileURLToPath(new URL("src/", root));
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const forbidden = [
  { pattern: /@supabase|integrations\/supabase/i, reason: "Supabase client integration" },
  { pattern: /THREDD_MOCK|thredd\.mock|mock_cards/i, reason: "Thredd/mock provider" },
  { pattern: /\/api\/card\//, reason: "legacy same-origin card route" },
  { pattern: /\$28,412\.90|Daniel Chen|10,204\.15/, reason: "known hardcoded account data" },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return nested.flat();
}

const failures = [];
for (const file of await sourceFiles(sourceRoot)) {
  const content = await readFile(file, "utf8");
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) {
      failures.push(`${relative(rootPath, file)}: ${rule.reason}`);
    }
  }
}

const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
for (const dependency of ["@supabase/supabase-js", "@lovable.dev/mcp-js"]) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    failures.push(`package.json: forbidden dependency ${dependency}`);
  }
}

const backendClient = await readFile(new URL("src/lib/backend-api.ts", root), "utf8");
for (const required of [
  "VITE_FASTLINK_API_URL",
  "VITE_FASTLINK_ENVIRONMENT",
  "/v1/session",
  "/v1/cards",
  "X-Trace-Id",
  "Idempotency-Key",
]) {
  if (!backendClient.includes(required)) {
    failures.push(`src/lib/backend-api.ts: missing ${required}`);
  }
}

const transferMutation = await readFile(
  new URL("src/lib/wallet-transfer-mutation-state.ts", root),
  "utf8",
);
const transferHook = await readFile(
  new URL("src/hooks/use-wallet-transfer-mutation.ts", root),
  "utf8",
);
const transferStatusHook = await readFile(
  new URL("src/hooks/use-wallet-transfer-status-refresh.ts", root),
  "utf8",
);
const transferPage = await readFile(new URL("src/routes/transfer.tsx", root), "utf8");
const transferRequirements = [
  [backendClient, "boundedResponseText", "bounded transfer transport"],
  [backendClient, "WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES", "bounded transfer accounts"],
  [backendClient, "WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES", "bounded transfer receipt"],
  [transferMutation, "walletTransferFailureIsAmbiguous", "ambiguous retry classifier"],
  [transferMutation, "retry.idempotencyKey", "same-key manual retry"],
  [transferHook, "mounted.current", "unmounted transfer completion guard"],
  [
    transferHook,
    'invalidateSession?.(session, "EXPLICIT_401")',
    "current transfer 401 invalidation",
  ],
  [transferStatusHook, "mounted.current", "unmounted status completion guard"],
  [
    transferStatusHook,
    'invalidateSession?.(session, "EXPLICIT_401")',
    "current status 401 invalidation",
  ],
  [transferPage, "sessionIdentity.current.generation", "exact Session object generation"],
  [transferPage, "transfer.retryPending", "manual retry input lock"],
];
for (const [content, required, reason] of transferRequirements) {
  if (!content.includes(required)) failures.push(`consumer transfer: missing ${reason}`);
}

if (failures.length) {
  console.error(
    ["Production wallet audit failed:", ...failures.map((item) => `- ${item}`)].join("\n"),
  );
  process.exit(1);
}

console.log(
  "Production wallet audit passed: Railway-only data path, no Supabase client, no mock fallback.",
);
