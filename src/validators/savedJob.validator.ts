import { z } from "zod";
import { createPaginationSchema } from "./common.validator";


export const getMySavedJobsSchema = z.object({
  query: createPaginationSchema(["createdAt", "title"] as const),
});

export const saveJobSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});

export const unsaveJobSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});
