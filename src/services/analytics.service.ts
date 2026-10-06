import { UserRole } from "../entities/User.entity";
import { NotFoundError } from "../utils/errors";
import { ensureRole } from "../utils/authorization.util";
import {
  AnalyticsRepository,
  analyticsRepository,
} from "../repositories/analytics.repository";
import {
  CompanyRepository,
  companyRepository,
} from "../repositories/company.repository";
import { EmployerAnalytics, WindowedCount } from "../types/analytics.types";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 5;

export class AnalyticsService {
  constructor(
    private readonly analyticsRepo: AnalyticsRepository = analyticsRepository,
    private readonly companyRepo: CompanyRepository = companyRepository
  ) {}

  async getEmployerAnalytics(
    employerId: string,
    role: string
  ): Promise<EmployerAnalytics> {
    ensureRole(role, UserRole.EMPLOYER, "Access denied");

    const company = await this.companyRepo.findByEmployerId(employerId);
    if (!company) {
      throw new NotFoundError("Company not found for this employer");
    }

    const now = Date.now();
    const last7 = new Date(now - 7 * DAY_MS);
    const prev7 = new Date(now - 14 * DAY_MS);

    // 4 truy vấn độc lập chạy song song (trước đây 1 + 1 + 9 truy vấn).
    const [jobCounts, applicationCounts, recentJobs, recentApplications] =
      await Promise.all([
        this.analyticsRepo.getJobCounts(company.id, last7, prev7),
        this.analyticsRepo.getApplicationCounts(company.id, last7, prev7),
        this.analyticsRepo.findRecentJobs(company.id, RECENT_LIMIT),
        this.analyticsRepo.findRecentApplications(company.id, RECENT_LIMIT),
      ]);

    return {
      counts: {
        totalActiveJobs: jobCounts.active,
        totalApplications: applicationCounts.total,
        totalHired: applicationCounts.hired,
        trends: {
          activeJobs: this.getTrend(jobCounts.created),
          applications: this.getTrend(applicationCounts.created),
          totalHired: this.getTrend(applicationCounts.hiredCreated),
        },
      },
      data: { recentJobs, recentApplications },
    };
  }

  /** % thay đổi so với 7 ngày trước; kỳ trước = 0 thì coi là +100% nếu có phát sinh. */
  private getTrend({ last7, prev7 }: WindowedCount): number {
    if (prev7 === 0) return last7 > 0 ? 100 : 0;
    return Math.round(((last7 - prev7) / prev7) * 100);
  }
}

export const analyticsService = new AnalyticsService();
