import { spawnSync } from "node:child_process";

const audit = spawnSync("bun", ["audit", "--json"], {
  encoding: "utf8",
});

const output = `${audit.stdout ?? ""}\n${audit.stderr ?? ""}`;
const jsonLine = output
  .split(/\r?\n/)
  .map((line) => line.trim())
  .findLast((line) => line.startsWith("{") && line.endsWith("}"));

if (!jsonLine) {
  console.error("Unable to parse bun audit output.");
  process.exit(1);
}

const advisories = Object.values(JSON.parse(jsonLine)).flat();
const acceptedUpstreamAdvisoryIds = new Set([1124334]);
const unexpected = advisories.filter((advisory) => !acceptedUpstreamAdvisoryIds.has(advisory.id));

if (unexpected.length > 0) {
  console.error(
    `Unexpected build dependency advisories: ${unexpected
      .map((advisory) => `${advisory.id}:${advisory.title}`)
      .join(", ")}`,
  );
  process.exit(1);
}

if (advisories.length === 0) {
  console.log("Build dependency audit passed with no advisories.");
  process.exit(0);
}

if (advisories.length !== 1 || advisories[0].id !== 1124334 || advisories[0].severity !== "high") {
  console.error("The controlled upstream advisory set changed.");
  process.exit(1);
}

console.log(
  "Build dependency audit passed with one controlled upstream-only advisory: GHSA-mh99-v99m-4gvg.",
);
