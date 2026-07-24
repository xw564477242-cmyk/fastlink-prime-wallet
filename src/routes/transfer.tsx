import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/transfer")({
  component: () => <UnavailableFeature title="Internal transfer" />,
});
