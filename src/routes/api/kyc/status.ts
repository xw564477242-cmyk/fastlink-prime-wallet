import { createFileRoute } from "@tanstack/react-router";

import { kycService } from "@/integrations/thredd/thredd.kyc.service";
import { getCurrentCustomerId } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/kyc/status")({
  server: {
    handlers: {
      GET: async () => {
        const customerId = getCurrentCustomerId();
        const result = await kycService.getKycStatus(customerId);
        return Response.json(result);
      },
    },
  },
});
