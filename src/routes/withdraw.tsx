import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/withdraw")({
  component: () => <UnavailableFeature title="Withdrawal" />,
});
