import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/kyc")({
  component: () => <UnavailableFeature title="KYC verification" />,
});
