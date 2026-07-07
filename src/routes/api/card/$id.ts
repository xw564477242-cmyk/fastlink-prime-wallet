import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";

export const Route = createFileRoute("/api/card/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const card = await cardService.getCardDetail(params.id);
        return Response.json({ card });
      },
    },
  },
});
