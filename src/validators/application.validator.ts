import { z } from "zod";
import { ApplicationStatus } from "../entities/Application.entity";
import { createPaginationSchema } from "./common.validator";

export const applyToJobSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});
export type ApplyToJobParams = z.infer<typeof applyToJobSchema>["params"];

export const getApplicantsSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});
export type GetApplicantsParams = z.infer<typeof getApplicantsSchema>["params"];

export const getApplicationByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid application ID format"),
  }),
});
export type GetApplicationByIdParams = z.infer<
  typeof getApplicationByIdSchema
>["params"];

export const updateApplicationStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid application ID format"),
  }),
  body: z.object({
    status: z.nativeEnum(ApplicationStatus),
  }),
});
export type UpdateApplicationStatusParams = z.infer<
  typeof updateApplicationStatusSchema
>["params"];
export type UpdateApplicationStatusBody = z.infer<
  typeof updateApplicationStatusSchema
>["body"];

const APPLICATION_SORTABLE_FIELDS = ["createdAt"] as const;

export const getMyApplicationsSchema = z.object({
  query: createPaginationSchema(
    APPLICATION_SORTABLE_FIELDS,
    "createdAt"
  ).extend({
    status: z.nativeEnum(ApplicationStatus).optional(),
  }),
});
export type GetMyApplicationsQuery = z.infer<
  typeof getMyApplicationsSchema
>["query"];
