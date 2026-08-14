import { z } from "zod";
import { createPaginationSchema } from "./common.validator";

export const getMySavedJobsSchema = z.object({
  query: createPaginationSchema(["createdAt", "title"] as const),
});
export type GetMySavedJobsQuery = z.infer<typeof getMySavedJobsSchema>["query"];

export const saveJobSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});
export type SavedJobParams = z.infer<typeof saveJobSchema>["params"];

export const unsaveJobSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});
export type UnsaveJobParams = z.infer<typeof unsaveJobSchema>["params"];
