import { AppDataSource } from "../config/database.config";
import { Application, ApplicationStatus } from "../entities/Application.entity";
import { Not } from "typeorm";
import { PaginationOptions, getSkip } from "../utils/pagination.util";

export interface MyApplicationsQuery extends PaginationOptions {
  status?: string;
}

const JOB_LIST_SELECT = {
  id: true,
  title: true,
  location: true,
  type: true,
  companyId: true,
  isClosed: true,
} as const;

const JOB_DETAIL_SELECT = {
  id: true,
  title: true,
  companyId: true,
  isClosed: true,
  location: true,
  type: true,
  salaryMin: true,
  salaryMax: true,
} as const;

const APPLICANT_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  resume: true,
} as const;

export class ApplicationRepository {
  private repo = AppDataSource.getRepository(Application);

  // ---- write ops ----

  create(data: Partial<Application>): Application {
    return this.repo.create(data);
  }

  async save(application: Application): Promise<Application> {
    return this.repo.save(application);
  }

  async update(id: string, data: Partial<Application>): Promise<void> {
    await this.repo.update(id, data);
  }

  // ---- single-record reads ----

  async findById(id: string): Promise<Application | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdAndApplicant(
    id: string,
    applicantId: string
  ): Promise<Application | null> {
    return this.repo.findOne({ where: { id, applicantId } });
  }

  async findByJobAndApplicant(
    jobId: string,
    applicantId: string
  ): Promise<Application | null> {
    return this.repo.findOne({ where: { jobId, applicantId } });
  }

  async findStatusByJobAndApplicant(
    jobId: string,
    applicantId: string
  ): Promise<Pick<Application, "status"> | null> {
    return this.repo.findOne({
      where: { jobId, applicantId },
      select: ["status"],
    });
  }

  async findByIdWithApplicant(id: string): Promise<Application | null> {
    return this.repo.findOne({ where: { id }, relations: ["applicant"] });
  }

  /** Dùng cho triggerAIAnalysis / updateApplicationStatus - cần job.company.employerId */
  async findByIdWithJobAndCompany(id: string): Promise<Application | null> {
    return this.repo.findOne({
      where: { id },
      relations: ["job", "job.company"],
    });
  }

  /** Dùng cho getApplicationById - full detail cho cả applicant & employer view */
  async findByIdWithJobAndApplicant(id: string): Promise<Application | null> {
    return this.repo.findOne({
      where: { id },
      relations: ["job", "job.company", "applicant"],
      select: { job: JOB_DETAIL_SELECT, applicant: APPLICANT_SELECT },
    });
  }

  async findAiFieldsById(id: string): Promise<Application | null> {
    return this.repo.findOne({
      where: { id },
      select: ["aiMatchingScore", "aiMatchingAnalysis", "aiAnalyzedAt"],
    });
  }

  // ---- list reads ----

  async findAndCountByApplicant(
    applicantId: string,
    { page, limit, sortBy, order, status }: MyApplicationsQuery
  ): Promise<[Application[], number]> {
    const where: any = { applicantId };

    if (status) {
      const enumValue = Object.values(ApplicationStatus).find(
        (v) => v === status
      );
      if (enumValue) where.status = enumValue;
    } else {
      // Hide withdrawn applications from the default list view
      where.status = Not(ApplicationStatus.WITHDRAWN);
    }

    return this.repo.findAndCount({
      where,
      relations: ["job", "job.company"],
      select: { job: JOB_LIST_SELECT },
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });
  }

  async findByJobExcludingWithdrawn(jobId: string): Promise<Application[]> {
    return this.repo.find({
      where: { jobId, status: Not(ApplicationStatus.WITHDRAWN) },
      relations: ["job", "applicant"],
      select: {
        job: {
          id: true,
          title: true,
          location: true,
          category: true,
          type: true,
          isClosed: true,
        },
        applicant: APPLICANT_SELECT,
      },
      order: { aiMatchingScore: "DESC", createdAt: "DESC" },
    });
  }

  async findStatusMapByApplicant(
    applicantId: string
  ): Promise<Record<string, string>> {
    const applications = await this.repo.find({
      where: { applicantId },
      select: ["jobId", "status"],
    });
    return applications.reduce(
      (map, app) => {
        map[app.jobId] = app.status;
        return map;
      },
      {} as Record<string, string>
    );
  }
}

export const applicationRepository = new ApplicationRepository();
