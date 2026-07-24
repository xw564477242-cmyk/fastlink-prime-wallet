import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/convert")({
  component: () => <UnavailableFeature title="Currency conversion" />,
});
