import { AppDataSource } from "../config/database.config";
import { Job } from "../entities/Job.entity";
import { SavedJob } from "../entities/SavedJob.entity";
import { Application } from "../entities/Application.entity";
import { Company } from "../entities/Company.entity";
import { NotFoundError } from "../utils/errors";
import { getSkip, buildPaginatedResult, PaginationOptions } from "../utils/pagination.util";
import { ensureOwnership } from "../utils/authorization.util";
import { jobRepository, JobFilters } from "../repositories/job.repository";
import { companyService } from "./company.service";

export class JobService {
  private jobRepository = AppDataSource.getRepository(Job);
  private savedJobRepository = AppDataSource.getRepository(SavedJob);
  private applicationRepository = AppDataSource.getRepository(Application);
  private companyRepository = AppDataSource.getRepository(Company);

  async createJob(userId: string, jobData: Partial<Job>): Promise<Job> {
    const company = await this.companyRepository.findOne({ where: { employerId: userId } });
    if (!company) {
      throw new NotFoundError("Company profile not found. Please create a company profile first.");
    }

    const job = this.jobRepository.create({ ...jobData, companyId: company.id });
    const savedJob = await this.jobRepository.save(job);
    await companyService.updateCompanyStats(company.id);
    return savedJob;
  }

  async getJobs(filters: JobFilters & { userId?: string }, pagination: PaginationOptions) {
    const [jobs, total] = await jobRepository.search(filters, pagination);

    let jobsWithExtras: any[] = jobs;
    if (filters.userId) {
      const [savedJobIds, statusMap] = await Promise.all([
        this.getSavedJobIds(filters.userId),
        this.getApplicationStatusMap(filters.userId),
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
    const { page, limit, sortBy, order } = pagination;
    const company = await this.companyRepository.findOne({ where: { employerId } });
    if (!company) return buildPaginatedResult<Job>([], 0, page, limit);

    const [jobs, total] = await this.jobRepository.findAndCount({
      where: { companyId: company.id },
      relations: ["company"],
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });

    return buildPaginatedResult(jobs, total, page, limit);
  }

  async getJobById(jobId: string, userId?: string): Promise<any> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ["company", "company.employer"],
      select: {
        company: {
          id: true, name: true, logo: true, size: true, industry: true,
          address: true, website: true, description: true, benefits: true, foundedYear: true,
        },
      },
    });
    if (!job) throw new NotFoundError("Job not found");

    let applicationStatus: string | null = null;
    let isSaved = false;

    if (userId) {
      const [application, savedJobRecord] = await Promise.all([
        this.applicationRepository.findOne({
          where: { jobId: job.id, applicantId: userId },
          select: ["status"],
        }),
        this.savedJobRepository.findOne({ where: { jobId: job.id, jobseekerId: userId } }),
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
    return this.jobRepository.save(job);
  }

  async deleteJob(jobId: string, userId: string): Promise<void> {
    const job = await this.getJobWithCompanyOrThrow(jobId);
    ensureOwnership(job.company.employerId, userId, "Not authorized to delete this job");
    await this.jobRepository.softDelete(jobId);
    await companyService.updateCompanyStats(job.companyId);
  }

  async toggleJobStatus(jobId: string, userId: string): Promise<{ message: string; isClosed: boolean }> {
    const job = await this.getJobWithCompanyOrThrow(jobId);
    ensureOwnership(job.company.employerId, userId, "Not authorized to modify this job");

    job.isClosed = !job.isClosed;
    await this.jobRepository.save(job);
    await companyService.updateCompanyStats(job.companyId);

    return {
      message: job.isClosed ? "Job closed successfully" : "Job opened successfully",
      isClosed: job.isClosed,
    };
  }

  private async getJobWithCompanyOrThrow(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId }, relations: ["company"] });
    if (!job) throw new NotFoundError("Job not found");
    return job;
  }

  private async getSavedJobIds(userId: string): Promise<string[]> {
    const savedJobs = await this.savedJobRepository.find({
      where: { jobseekerId: userId },
      select: ["jobId"],
    });
    return savedJobs.map((s) => s.jobId);
  }

  private async getApplicationStatusMap(userId: string): Promise<Record<string, string>> {
    const applications = await this.applicationRepository.find({
      where: { applicantId: userId },
      select: ["jobId", "status"],
    });
    return applications.reduce((map, app) => {
      map[app.jobId] = app.status;
      return map;
    }, {} as Record<string, string>);
  }
}

export const jobService = new JobService();