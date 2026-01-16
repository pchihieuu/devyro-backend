import { z } from "zod";
import { ApplicationStatus } from "../entities/Application.entity";

export const applyToJobSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});

export const getApplicantsSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Invalid job ID format"),
  }),
});

export const getApplicationByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid application ID format"),
  }),
});

export const updateApplicationStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid application ID format"),
  }),
  body: z.object({
    status: z.nativeEnum(ApplicationStatus),
  }),
});