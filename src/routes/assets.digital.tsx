import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/assets/digital")({
  component: () => <UnavailableFeature title="Digital assets" />,
});
