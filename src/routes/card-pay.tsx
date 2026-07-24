import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/card-pay")({
  component: () => <UnavailableFeature title="Card payment" />,
});
