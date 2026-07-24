import { Job } from "../entities/Job.entity";
import { NotFoundError } from "../utils/errors";
import { buildPaginatedResult, PaginationOptions } from "../utils/pagination.util";
import { ensureOwnership } from "../utils/authorization.util";
import { jobRepository, JobRepository, JobFilters } from "../repositories/job.repository";
import { savedJobRepository, SavedJobRepository } from "../repositories/savedJob.repository";
import { applicationRepository, ApplicationRepository } from "../repositories/application.repository";
import { companyRepository, CompanyRepository } from "../repositories/company.repository";
import { companyService } from "./company.service";

export class JobService {
  constructor(
    private readonly jobRepo: JobRepository = jobRepository,
    private readonly savedJobRepo: SavedJobRepository = savedJobRepository,
    private readonly applicationRepo: ApplicationRepository = applicationRepository,
    private readonly companyRepo: CompanyRepository = companyRepository
  ) {}

  async createJob(userId: string, jobData: Partial<Job>): Promise<Job> {
    const company = await this.companyRepo.findByEmployerId(userId);
    if (!company) {
      throw new NotFoundError(
        "Company profile not found. Please create a company profile first."
      );
    }

    const job = this.jobRepo.create({ ...jobData, companyId: company.id });
    const savedJob = await this.jobRepo.save(job);
    await companyService.updateCompanyStats(company.id);
    return savedJob;
  }

  async getJobs(filters: JobFilters & { userId?: string }, pagination: PaginationOptions) {
    const [jobs, total] = await this.jobRepo.search(filters, pagination);

    let jobsWithExtras: any[] = jobs;
    if (filters.userId) {
      const [savedJobIds, statusMap] = await Promise.all([
        this.savedJobRepo.findJobIdsByJobseeker(filters.userId),
        this.applicationRepo.findStatusMapByApplicant(filters.userId),
      ]);
      jobsWithExtras = jobs.map((job) => ({
        ...job,
        isSaved: savedJobIds.includes(job.id),
        applicationStatus: statusMap[job.id] || null,
      }));
    }

    return buildPaginatedResult(jobsWithExtras, total, pagination.page, pagination.limit);
  }

  async getJobsEmployer(employerId: string, pagination: PaginationOptions) {
    const { page, limit } = pagination;
    const company = await this.companyRepo.findByEmployerId(employerId);
    if (!company) return buildPaginatedResult<Job>([], 0, page, limit);

    const [jobs, total] = await this.jobRepo.findAndCountByCompany(company.id, pagination);
    return buildPaginatedResult(jobs, total, page, limit);
  }

  async getJobById(jobId: string, userId?: string): Promise<any> {
    const job = await this.jobRepo.findByIdWithCompanyDetail(jobId);
    if (!job) throw new NotFoundError("Job not found");

    let applicationStatus: string | null = null;
    let isSaved = false;

    if (userId) {
      const [application, savedJobRecord] = await Promise.all([
        this.applicationRepo.findStatusByJobAndApplicant(job.id, userId),
        this.savedJobRepo.findOneActive(job.id, userId),
      ]);
      applicationStatus = application?.status ?? null;
      isSaved = !!savedJobRecord;
    }

    return { ...job, applicationStatus, isSaved };
  }

  async updateJob(jobId: string, userId: string, updates: Partial<Job>): Promise<Job> {
    const job = await this.getJobWithCompanyOrThrow(jobId);
    ensureOwnership(job.company.employerId, userId, "Not authorized to update this job");
    Object.assign(job, updates);
    return this.jobRepo.save(job);
  }

  async deleteJob(jobId: string, userId: string): Promise<void> {
    const job = await this.getJobWithCompanyOrThrow(jobId);
    ensureOwnership(job.company.employerId, userId, "Not authorized to delete this job");
    await this.jobRepo.softDelete(jobId);
    await companyService.updateCompanyStats(job.companyId);
  }

  async toggleJobStatus(
    jobId: string,
    userId: string
  ): Promise<{ message: string; isClosed: boolean }> {
    const job = await this.getJobWithCompanyOrThrow(jobId);
    ensureOwnership(job.company.employerId, userId, "Not authorized to modify this job");

    job.isClosed = !job.isClosed;
    await this.jobRepo.save(job);
    await companyService.updateCompanyStats(job.companyId);

    return {
      message: job.isClosed ? "Job closed successfully" : "Job opened successfully",
      isClosed: job.isClosed,
    };
  }

  private async getJobWithCompanyOrThrow(jobId: string): Promise<Job> {
    const job = await this.jobRepo.findByIdWithCompany(jobId);
    if (!job) throw new NotFoundError("Job not found");
    return job;
  }
}

export const jobService = new JobService();