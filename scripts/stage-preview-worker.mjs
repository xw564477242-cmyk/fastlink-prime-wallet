import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const rel of [".output/server/index.mjs", ".output/public"])
  if (!fs.existsSync(path.join(root, rel))) throw Error("Cloudflare target artifact missing");
for (const rel of [
  "preview-gateway.ts",
  "launch/preview-readonly-policy.ts",
  "launch/b10-policy.ts",
]) {
  const out = path.join(root, ".preview-build/publish", rel.replace(/\.ts$/, ".js"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const source = fs.readFileSync(path.join(root, "src", rel), "utf8");
  let code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  code = code
    .replaceAll("'./launch/preview-readonly-policy'", "'./launch/preview-readonly-policy.js'")
    .replaceAll("'./b10-policy'", "'./b10-policy.js'");
  fs.writeFileSync(out, code);
}
const publish = path.join(root, ".preview-build/publish");
fs.copyFileSync(
  path.join(root, "deploy/preview/worker-entry.mjs"),
  path.join(publish, "worker.js"),
);
fs.cpSync(path.join(root, ".output/server"), path.join(publish, "server"), {
  recursive: true,
  filter: (source) => !["wrangler.json", ".dev.vars"].includes(path.basename(source)),
});
fs.cpSync(path.join(root, ".output/public"), path.join(publish, "public"), { recursive: true });
const config = JSON.parse(fs.readFileSync(path.join(root, "wrangler.preview.jsonc"), "utf8"));
config.main = "worker.js";
config.assets.directory = "public";
fs.writeFileSync(path.join(publish, "wrangler.json"), JSON.stringify(config, null, 2) + "\n");
if (fs.existsSync(path.join(publish, ".wrangler")))
  throw Error("Config redirect must not enter publication root");
