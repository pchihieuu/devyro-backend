import { z } from "zod";
import { OpCatalog } from "../types";
import { job, jobWithExtras } from "../schemas/job";

export const jobsCatalog: OpCatalog = {
  "GET /jobs/employer": {
    summary: "My Company's Job Listings",
    roles: ["employer"],
    data: job,
    paginated: true,
  },
  "PATCH /jobs/:id/toggle-close": {
    summary: "Close / Open Job Posting",
    roles: ["employer"],
    data: z.object({ isClosed: z.boolean() }),
  },
  "POST /jobs": {
    summary: "Post a Job Opening",
    roles: ["employer"],
    status: 201,
    data: job,
    errors: {
      400: "Company profile not found - must create company profile before posting jobs",
    },
  },
  "GET /jobs": {
    summary: "Job Listings (filter, sort, paginate)",
    description:
      "Log in (optional) to retrieve `isSaved` / `applicationStatus` specific to the viewer. Filter `skills` using the overlap operator (&&) on the `text[]` column.",
    data: jobWithExtras,
    paginated: true,
  },
  "GET /jobs/:id": { summary: "Job details", data: jobWithExtras },
  "PUT /jobs/:id": {
    summary: "Recruitment updates",
    roles: ["employer"],
    data: job,
  },
  "DELETE /jobs/:id": { summary: "Delete job posting", roles: ["employer"] },
};
