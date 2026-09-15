export function resolveFrontendRuntime(api?: string, environment?: string) {
  const apiUrl = api?.trim().replace(/\/+$/, "") ?? "";
  const normalized = environment?.trim().toUpperCase();
  const validEnvironment = normalized === "TEST" || normalized === "SANDBOX";
  return {
    apiUrl,
    environment: validEnvironment ? normalized : undefined,
    error: !validEnvironment
      ? "VITE_FASTLINK_ENVIRONMENT must be TEST or SANDBOX"
      : apiUrl !== "/api"
        ? "VITE_FASTLINK_API_URL must be /api"
        : null,
  } as const;
}
