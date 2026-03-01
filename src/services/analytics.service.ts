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

    const totalActiveJobs = await this.jobRepository.count({
      where: { companyId: company.id, isClosed: false },
    });

    const totalApplications =
      jobIds.length > 0
        ? await this.applicationRepository.count({
            where: { jobId: In(jobIds) },
          })
        : 0;

    const totalHired =
      jobIds.length > 0
        ? await this.applicationRepository.count({
            where: { jobId: In(jobIds), status: ApplicationStatus.ACCEPTED },
          })
        : 0;

    const activeJobsLast7 = await this.jobRepository.count({
      where: {
        companyId: company.id,
        createdAt: MoreThanOrEqual(last7Days),
      },
    });

    const activeJobsPrev7 = await this.jobRepository.count({
      where: {
        companyId: company.id,
        createdAt: Between(prev7Days, last7Days),
      },
    });

    const activeJobTrend = this.getTrend(activeJobsLast7, activeJobsPrev7);

    const applicationsLast7 =
      jobIds.length > 0
        ? await this.applicationRepository.count({
            where: {
              jobId: In(jobIds),
              createdAt: MoreThanOrEqual(last7Days),
            },
          })
        : 0;

    const applicationsPrev7 =
      jobIds.length > 0
        ? await this.applicationRepository.count({
            where: {
              jobId: In(jobIds),
              createdAt: Between(prev7Days, last7Days),
            },
          })
        : 0;

    const applicantTrend = this.getTrend(applicationsLast7, applicationsPrev7);

    const hiredLast7 =
      jobIds.length > 0
        ? await this.applicationRepository.count({
            where: {
              jobId: In(jobIds),
              status: ApplicationStatus.ACCEPTED,
              createdAt: MoreThanOrEqual(last7Days),
            },
          })
        : 0;

    const hiredPrev7 =
      jobIds.length > 0
        ? await this.applicationRepository.count({
            where: {
              jobId: In(jobIds),
              status: ApplicationStatus.ACCEPTED,
              createdAt: Between(prev7Days, last7Days),
            },
          })
        : 0;

    const hiredTrend = this.getTrend(hiredLast7, hiredPrev7);

    const recentJobs = await this.jobRepository.find({
      where: { companyId: company.id },
      select: ["id", "title", "location", "type", "createdAt", "isClosed"],
      order: { createdAt: "DESC" },
      take: 5,
    });

    const recentApplications =
      jobIds.length > 0
        ? await this.applicationRepository.find({
            where: { jobId: In(jobIds) },
            relations: ["applicant", "job"],
            order: { createdAt: "DESC" },
            take: 5,
          })
        : [];

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
