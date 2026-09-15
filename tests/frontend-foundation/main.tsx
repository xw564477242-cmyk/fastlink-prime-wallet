// Local component fixture only: no router, authentication, backend or business requests.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import "../../src/styles.css";
import { Button } from "../../src/components/ui/button";
import { PublicErrorProvider, usePublicError } from "../../src/components/PublicErrorProvider";
import { PublicErrorQueue } from "../../src/lib/public-errors";
import { BackendApiError, backendRuntime } from "../../src/lib/backend-api";
const queue = new PublicErrorQueue(
  `fixture:${backendRuntime.environment}`,
  () => true,
  () => queue.clear(),
);
function Fixture() {
  const report = usePublicError();
  const [attempts, setAttempts] = useState(0);
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="font-display text-xl">公共异常组件验证</h1>
      <p>{backendRuntime.environment} · 本地模拟</p>
      <Button
        onClick={() =>
          report({
            operation: "fixture-read",
            reason: new BackendApiError(408, "fixture-timeout", "not displayed"),
            isCurrent: () => true,
            retry: {
              safeReadOnly: true,
              run: async (signal, isCurrent) => {
                await new Promise((resolve) => setTimeout(resolve, 1200));
                if (!signal.aborted && isCurrent()) setAttempts((n) => n + 1);
              },
            },
          })
        }
      >
        模拟超时
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          report({
            operation: "fixture-permission",
            reason: new BackendApiError(403, "fixture-403", "not displayed"),
            isCurrent: () => true,
          })
        }
      >
        模拟无权限
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          report({
            operation: "fixture-failure",
            reason: new BackendApiError(500, "fixture-500", "not displayed"),
            isCurrent: () => true,
            retry: {
              safeReadOnly: true,
              run: async () => {
                throw new BackendApiError(408, "fixture-retry-failed", "not displayed");
              },
            },
          })
        }
      >
        模拟重试失败
      </Button>
      <p>成功重试次数：{attempts}</p>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <PublicErrorProvider queue={queue}>
    <Fixture />
  </PublicErrorProvider>,
);
