import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/merchant-pay")({
  component: () => <UnavailableFeature title="Merchant payment" />,
});
