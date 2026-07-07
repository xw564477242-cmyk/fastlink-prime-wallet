import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";

export const Route = createFileRoute("/api/card/$id/freeze")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const card = await cardService.freezeCard(params.id);
        return Response.json({ card });
      },
    },
  },
});
