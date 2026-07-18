import { createFileRoute } from "@tanstack/react-router";

import { kycService } from "@/integrations/thredd/thredd.kyc.service";
import { requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/kyc/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const customerId = await requireCustomerId(request);
          const result = await kycService.getKycStatus(customerId);
          return Response.json(result);
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
