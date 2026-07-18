import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { kycService } from "@/integrations/thredd/thredd.kyc.service";
import { requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

const Body = z.object({
  documentType: z.enum(["passport", "id_card", "driver_license"]),
  documentNumber: z.string().min(3).max(64),
  documentFrontUrl: z.string().url().optional(),
  documentBackUrl: z.string().url().optional(),
  selfieUrl: z.string().url().optional(),
  addressLine1: z.string().min(2).max(200),
  city: z.string().min(1).max(100),
  country: z.string().min(2).max(2),
  postalCode: z.string().min(1).max(20),
  dateOfBirth: z.string().min(8).max(20),
});

export const Route = createFileRoute("/api/kyc/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const customerId = await requireCustomerId(request);
          const input = Body.parse(await request.json());
          const result = await kycService.submitKyc({ customerId, ...input });
          return Response.json(result);
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
