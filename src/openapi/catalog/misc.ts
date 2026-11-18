import { z } from "zod";
import { OpCatalog } from "../types";
import { savedJob } from "../schemas/job";
import { employerAnalytics, notification } from "../schemas/misc";

export const savedJobsCatalog: OpCatalog = {
  "POST /saved-jobs/:jobId": {
    summary: "Save job",
    status: 201,
    data: savedJob,
  },
  "DELETE /saved-jobs/:jobId": { summary: "Remove saved job" },
  "GET /saved-jobs/my": {
    summary: "Saved jobs",
    data: savedJob,
    paginated: true,
  },
};

export const analyticsCatalog: OpCatalog = {
  "GET /analytics/overview": {
    summary: "Employer Overview",
    description:
      "`counts` Appears twice: in `data.counts` and at the top-level `counts` (retained for backward compatibility with the legacy frontend — `data.counts` should be used).",
    roles: ["employer"],
    data: employerAnalytics,
    extra: { counts: employerAnalytics.shape.counts },
  },
};

export const notificationsCatalog: OpCatalog = {
  "GET /notifications/unread-count": {
    summary: "Number of unread notifications",
    data: z.object({ count: z.number().int() }),
  },
  "PUT /notifications/read-all": { summary: "Mark all as read" },
  "GET /notifications": {
    summary: "List of notifications",
    data: notification,
    paginated: true,
    meta: z.object({ unreadCount: z.number().int() }),
  },
  "PUT /notifications/:id/read": { summary: "Mark as read" },
  "DELETE /notifications/:id": { summary: "Clear notifications" },
};
