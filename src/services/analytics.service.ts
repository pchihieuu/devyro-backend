import { AppDataSource } from "../config/database.config";
import { Job } from "../entities/Job.entity";
import { Application, ApplicationStatus } from "../entities/Application.entity";
import { In, MoreThanOrEqual, Between } from "typeorm";

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
  private applicationRepository = AppDataSource.getRepository(Application);

  private getTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  async getEmployerAnalytics(companyId: string): Promise<AnalyticsData> {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);
    const prev7Days = new Date(now);
    prev7Days.setDate(now.getDate() - 14);

    // Get all job IDs for this company
    const jobs = await this.jobRepository.find({
      where: { companyId },
      select: ["id"],
    });
    const jobIds = jobs.map((job) => job.id);

    // Count totals
    const totalActiveJobs = await this.jobRepository.count({
      where: { companyId, isClosed: false },
    });

    const totalApplications = await this.applicationRepository.count({
      where: { jobId: In(jobIds) },
    });

    const totalHired = await this.applicationRepository.count({
      where: { jobId: In(jobIds), status: ApplicationStatus.ACCEPTED },
    });

    // Active job trends
    const activeJobsLast7 = await this.jobRepository.count({
      where: {
        companyId,
        createdAt: MoreThanOrEqual(last7Days),
      },
    });

    const activeJobsPrev7 = await this.jobRepository.count({
      where: {
        companyId,
        createdAt: Between(prev7Days, last7Days),
      },
    });

    const activeJobTrend = this.getTrend(activeJobsLast7, activeJobsPrev7);

    // Application trends
    const applicationsLast7 = await this.applicationRepository.count({
      where: {
        jobId: In(jobIds),
        createdAt: MoreThanOrEqual(last7Days),
      },
    });

    const applicationsPrev7 = await this.applicationRepository.count({
      where: {
        jobId: In(jobIds),
        createdAt: Between(prev7Days, last7Days),
      },
    });

    const applicantTrend = this.getTrend(applicationsLast7, applicationsPrev7);

    // Hired trends
    const hiredLast7 = await this.applicationRepository.count({
      where: {
        jobId: In(jobIds),
        status: ApplicationStatus.ACCEPTED,
        createdAt: MoreThanOrEqual(last7Days),
      },
    });

    const hiredPrev7 = await this.applicationRepository.count({
      where: {
        jobId: In(jobIds),
        status: ApplicationStatus.ACCEPTED,
        createdAt: Between(prev7Days, last7Days),
      },
    });

    const hiredTrend = this.getTrend(hiredLast7, hiredPrev7);

    // Recent data
    const recentJobs = await this.jobRepository.find({
      where: { companyId },
      select: ["id", "title", "location", "type", "createdAt", "isClosed"],
      order: { createdAt: "DESC" },
      take: 5,
    });

    const recentApplications = await this.applicationRepository.find({
      where: { jobId: In(jobIds) },
      relations: ["applicant", "job"],
      select: {
        applicant: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
        job: {
          id: true,
          title: true,
        },
      },
      order: { createdAt: "DESC" },
      take: 5,
    });

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
        recentApplications,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();