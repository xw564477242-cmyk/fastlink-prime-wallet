import { createFileRoute } from "@tanstack/react-router";
import { UnavailableFeature } from "@/components/UnavailableFeature";

export const Route = createFileRoute("/connect")({
  component: () => (
    <UnavailableFeature
      title="Assistant connection"
      detail="Unavailable · demo MCP tools and static account data were removed from the production wallet."
    />
  ),
});
