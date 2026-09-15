import { expect, it } from "bun:test";
import { resolveFrontendRuntime } from "./frontend-runtime";
it("accepts only explicit TEST/SANDBOX and same-origin /api", () => {
  for (const environment of ["TEST", "SANDBOX"] as const) {
    expect(resolveFrontendRuntime(" /api/ ", ` ${environment.toLowerCase()} `)).toEqual({
      apiUrl: "/api",
      environment,
      error: null,
    });
  }
  for (const environment of [undefined, "", "LOCAL", "UAT", "PRODUCTION", "SANDBOXX"])
    expect(resolveFrontendRuntime("/api", environment).error).not.toBeNull();
  for (const url of [
    undefined,
    "",
    "https://example.invalid/api",
    "//example.invalid/api",
    "/api/v1",
  ])
    expect(resolveFrontendRuntime(url, "TEST").error).not.toBeNull();
});
