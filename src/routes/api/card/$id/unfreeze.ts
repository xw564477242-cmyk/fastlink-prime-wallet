import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";

export const Route = createFileRoute("/api/card/$id/unfreeze")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const card = await cardService.unfreezeCard(params.id);
        return Response.json({ card });
      },
    },
  },
});
