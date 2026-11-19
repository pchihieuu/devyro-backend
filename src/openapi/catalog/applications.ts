import { z } from "zod";
import { OpCatalog } from "../types";
import {
  aiMatchingAnalysis,
  application,
  applicationStatus,
} from "../schemas/application";

export const applicationsCatalog: OpCatalog = {
  "POST /applications/apply/:jobId": {
    summary: "Apply",
    roles: ["jobseeker"],
    status: 201,
    data: application,
    description:
      "AI matching runs in the background after an order is created (results appear under `aiMatching*` after a few seconds).",
    errors: { 409: "Already applied for this job posting" },
  },
  "GET /applications/my": {
    summary: "My job application",
    roles: ["jobseeker"],
    data: application,
    paginated: true,
  },
  "GET /applications/job/:jobId": {
    summary: "An applicant for a job posting",
    roles: ["employer"],
    data: z.array(application),
    meta: z.object({ total: z.number().int() }),
  },
  "GET /applications/:id": {
    summary: "Application details",
    data: application,
  },
  "PUT /applications/:id/status": {
    summary: "Change order status",
    roles: ["employer"],
    data: z.object({ status: applicationStatus }),
  },
  "DELETE /applications/:id/withdraw": {
    summary: "Withdraw application",
    roles: ["jobseeker"],
  },
  "POST /applications/:id/analyze": {
    summary: "Run AI matching for orders",
    roles: ["employer"],
    data: aiMatchingAnalysis,
    errors: {
      429: "AI quota exhausted - the body includes a `retryAfter` field (in seconds)",
      503: "AI overloaded - the body includes an additional `retryAfter` field (in seconds)",
    },
  },
};
