import { z } from "zod";

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
