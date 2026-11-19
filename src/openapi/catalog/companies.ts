import { z } from "zod";
import { OpCatalog } from "../types";
import { companyDetail, job } from "../schemas/job";

export const companiesCatalog: OpCatalog = {
  "GET /companies": {
    summary: "List of companies",
    data: companyDetail,
    paginated: true,
  },
  "GET /companies/my": {
    summary: "My company",
    roles: ["employer"],
    data: companyDetail,
  },
  "GET /companies/:id/jobs": {
    summary: "A company's operations",
    data: job,
    paginated: true,
  },
  "GET /companies/:id": { summary: "Company details", data: companyDetail },
  "POST /companies": {
    summary: "Create a company profile",
    roles: ["employer"],
    status: 201,
    data: companyDetail,
    errors: { 409: "The employer already has a company." },
  },
  "PUT /companies/:id": {
    summary: "Company update",
    roles: ["employer"],
    data: companyDetail,
  },
  "DELETE /companies/:id": { summary: "Delete company", roles: ["employer"] },
  "POST /companies/upload-logo": {
    summary: "Upload company logo",
    status: 201,
    data: z.object({ logoUrl: z.string().url(), publicId: z.string() }),
    multipart: { field: "image" },
  },
};
