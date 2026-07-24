import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/assets/fiat")({
  component: () => <UnavailableFeature title="Fiat wallets" />,
});
