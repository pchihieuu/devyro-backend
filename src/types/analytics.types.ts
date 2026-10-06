import { Application } from "../entities/Application.entity";
import { Job } from "../entities/Job.entity";
import { User } from "../entities/User.entity";

export type RecentJob = Pick<
  Job,
  "id" | "title" | "location" | "type" | "createdAt" | "isClosed"
>;

export type RecentApplication = Pick<
  Application,
  "id" | "status" | "updatedAt" | "createdAt"
> & {
  applicant: Pick<User, "id" | "name" | "email" | "avatar"> | null;
  job: Pick<Job, "id" | "title"> | null;
};

export type EmployerAnalytics = {
  counts: {
    totalActiveJobs: number;
    totalApplications: number;
    totalHired: number;
    trends: {
      activeJobs: number;
      applications: number;
      totalHired: number;
    };
  };
  data: {
    recentJobs: RecentJob[];
    recentApplications: RecentApplication[];
  };
};

/** Kết quả đếm của 1 cửa sổ 7 ngày gần nhất và 7 ngày liền trước đó. */
export type WindowedCount = { last7: number; prev7: number };

export type JobCounts = { active: number; created: WindowedCount };

export type ApplicationCounts = {
  total: number;
  hired: number;
  created: WindowedCount;
  hiredCreated: WindowedCount;
};
