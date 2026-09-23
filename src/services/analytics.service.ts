import { AppDataSource } from "../config/database.config";
import { Job } from "../entities/Job.entity";
import { Company } from "../entities/Company.entity";
import { Application, ApplicationStatus } from "../entities/Application.entity";
import { In, MoreThanOrEqual, Between } from "typeorm";
import { NotFoundError } from "../utils/errors";

interface AnalyticsData {
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
    recentJobs: any[];
    recentApplications: any[];
  };
}

export class AnalyticsService {
  private jobRepository = AppDataSource.getRepository(Job);
  private companyRepository = AppDataSource.getRepository(Company);
  private applicationRepository = AppDataSource.getRepository(Application);

  private getTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  async getEmployerAnalytics(employerId: string): Promise<AnalyticsData> {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);
    const prev7Days = new Date(now);
    prev7Days.setDate(now.getDate() - 14);

    const company = await this.companyRepository.findOne({
      where: { employerId },
    });

    if (!company) {
      throw new NotFoundError("Company not found for this employer");
    }

    const jobs = await this.jobRepository.find({
      where: { companyId: company.id },
      select: ["id"],
    });
    const jobIds = jobs.map((job) => job.id);
    const hasJobs = jobIds.length > 0;

    // PERF FIX: these 10 counts/finds are all independent of one another —
    // they were previously awaited one at a time (10 sequential DB
    // round-trips per analytics request, each paying full network+planner
    // latency back-to-back). Firing them together cuts wall-clock time to
    // roughly the slowest single query instead of the sum of all of them.
    const [
      totalActiveJobs,
      totalApplications,
      totalHired,
      activeJobsLast7,
      activeJobsPrev7,
      applicationsLast7,
      applicationsPrev7,
      hiredLast7,
      hiredPrev7,
      recentJobs,
      recentApplications,
    ] = await Promise.all([
      this.jobRepository.count({
        where: { companyId: company.id, isClosed: false },
      }),
      hasJobs
        ? this.applicationRepository.count({ where: { jobId: In(jobIds) } })
        : Promise.resolve(0),
      hasJobs
        ? this.applicationRepository.count({
            where: { jobId: In(jobIds), status: ApplicationStatus.ACCEPTED },
          })
        : Promise.resolve(0),
      this.jobRepository.count({
        where: { companyId: company.id, createdAt: MoreThanOrEqual(last7Days) },
      }),
      this.jobRepository.count({
        where: {
          companyId: company.id,
          createdAt: Between(prev7Days, last7Days),
        },
      }),
      hasJobs
        ? this.applicationRepository.count({
            where: { jobId: In(jobIds), createdAt: MoreThanOrEqual(last7Days) },
          })
        : Promise.resolve(0),
      hasJobs
        ? this.applicationRepository.count({
            where: {
              jobId: In(jobIds),
              createdAt: Between(prev7Days, last7Days),
            },
          })
        : Promise.resolve(0),
      hasJobs
        ? this.applicationRepository.count({
            where: {
              jobId: In(jobIds),
              status: ApplicationStatus.ACCEPTED,
              createdAt: MoreThanOrEqual(last7Days),
            },
          })
        : Promise.resolve(0),
      hasJobs
        ? this.applicationRepository.count({
            where: {
              jobId: In(jobIds),
              status: ApplicationStatus.ACCEPTED,
              createdAt: Between(prev7Days, last7Days),
            },
          })
        : Promise.resolve(0),
      this.jobRepository.find({
        where: { companyId: company.id },
        select: ["id", "title", "location", "type", "createdAt", "isClosed"],
        order: { createdAt: "DESC" },
        take: 5,
      }),
      hasJobs
        ? this.applicationRepository.find({
            where: { jobId: In(jobIds) },
            relations: ["applicant", "job"],
            order: { createdAt: "DESC" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    const activeJobTrend = this.getTrend(activeJobsLast7, activeJobsPrev7);
    const applicantTrend = this.getTrend(applicationsLast7, applicationsPrev7);
    const hiredTrend = this.getTrend(hiredLast7, hiredPrev7);

    const mappedApplications = recentApplications.map((app) => ({
      id: app.id,
      status: app.status,
      updatedAt: app.updatedAt,
      createdAt: app.createdAt,
      applicant: app.applicant
        ? {
            id: app.applicant.id,
            name: app.applicant.name,
            email: app.applicant.email,
            avatar: app.applicant.avatar,
          }
        : null,
      job: app.job
        ? {
            id: app.job.id,
            title: app.job.title,
          }
        : null,
    }));

    return {
      counts: {
        totalActiveJobs,
        totalApplications,
        totalHired,
        trends: {
          activeJobs: activeJobTrend,
          applications: applicantTrend,
          totalHired: hiredTrend,
        },
      },
      data: {
        recentJobs,
        recentApplications: mappedApplications,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
