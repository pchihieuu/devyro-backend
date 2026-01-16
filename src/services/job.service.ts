import { AppDataSource } from "../config/database.config";
import { Job, JobType } from "../entities/Job.entity";
import { SavedJob } from "../entities/SavedJob.entity";
import { Application } from "../entities/Application.entity";
import { In, Like, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { NotFoundError, ForbiddenError } from "../utils/errors";

interface JobFilters {
  keyword?: string;
  location?: string;
  category?: string | string[];
  type?: string | string[];
  minSalary?: string;
  maxSalary?: string;
  userId?: string;
}

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  order: "ASC" | "DESC";
}

export class JobService {
  private jobRepository = AppDataSource.getRepository(Job);
  private savedJobRepository = AppDataSource.getRepository(SavedJob);
  private applicationRepository = AppDataSource.getRepository(Application);

  async createJob(userId: string, jobData: Partial<Job>): Promise<Job> {
    const job = this.jobRepository.create({
      ...jobData,
      companyId: userId,
    });

    return await this.jobRepository.save(job);
  }

  async getJobs(
    filters: JobFilters,
    pagination: PaginationOptions
  ): Promise<{
    jobs: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page, limit, sortBy, order } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { isClosed: false };

    if (filters.keyword) {
      where.title = Like(`%${filters.keyword}%`);
    }

    if (filters.location) {
      where.location = Like(`%${filters.location}%`);
    }

    if (filters.category) {
      const categories = Array.isArray(filters.category)
        ? filters.category
        : [filters.category];
      where.category = In(categories);
    }

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      where.type = In(types as JobType[]);
    }

    if (filters.minSalary && filters.maxSalary) {
      where.salaryMin = LessThanOrEqual(Number(filters.maxSalary));
      where.salaryMax = MoreThanOrEqual(Number(filters.minSalary));
    } else if (filters.minSalary) {
      where.salaryMax = MoreThanOrEqual(Number(filters.minSalary));
    } else if (filters.maxSalary) {
      where.salaryMin = LessThanOrEqual(Number(filters.maxSalary));
    }

    const [jobs, total] = await this.jobRepository.findAndCount({
      where,
      relations: ["company"],
      select: {
        company: {
          id: true,
          name: true,
          companyName: true,
          companyLogo: true,
        },
      },
      order: { [sortBy]: order },
      skip,
      take: limit,
    });

    let jobsWithExtras = jobs;

    if (filters.userId) {
      const savedJobIds = await this.getSavedJobIds(filters.userId);
      const appliedJobStatusMap = await this.getApplicationStatusMap(
        filters.userId
      );

      jobsWithExtras = jobs.map((job) => ({
        ...job,
        isSaved: savedJobIds.includes(job.id),
        applicationStatus: appliedJobStatusMap[job.id] || null,
      }));
    }

    return {
      jobs: jobsWithExtras,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getJobsEmployer(
    employerId: string,
    pagination: PaginationOptions
  ): Promise<{
    jobs: Job[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit, sortBy, order } = pagination;
    const skip = (page - 1) * limit;

    const [jobs, total] = await this.jobRepository.findAndCount({
      where: {
        companyId: employerId,
      },
      order: {
        [sortBy]: order,
      },
      skip,
      take: limit,
    });

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJobById(jobId: string, userId?: string): Promise<any> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ["company"],
      select: {
        company: {
          id: true,
          name: true,
          companyName: true,
          companyLogo: true,
          companySize: true,
          companyIndustry: true,
          companyAddress: true,
          companyWebsite: true,
          companyDescription: true,
        },
      },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    let applicationStatus = null;
    let isSaved = false;

    if (userId) {
      const application = await this.applicationRepository.findOne({
        where: { jobId: job.id, applicantId: userId },
        select: ["status"],
      });

      if (application) {
        applicationStatus = application.status;
      }

      const savedJobRecord = await this.savedJobRepository.findOne({
        where: { jobId: job.id, jobseekerId: userId },
      });

      if (savedJobRecord) {
        isSaved = true;
      }
    }

    return {
      ...job,
      applicationStatus,
      isSaved,
    };
  }

  async updateJob(
    jobId: string,
    userId: string,
    updates: Partial<Job>
  ): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    if (job.companyId !== userId) {
      throw new ForbiddenError("Not authorized to update this job");
    }

    Object.assign(job, updates);
    return await this.jobRepository.save(job);
  }

  async deleteJob(jobId: string, userId: string): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    if (job.companyId !== userId) {
      throw new ForbiddenError("Not authorized to delete this job");
    }

    await this.jobRepository.softDelete(jobId);
  }

  async toggleJobStatus(
    jobId: string,
    userId: string
  ): Promise<{ message: string; isClosed: boolean }> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    if (job.companyId !== userId) {
      throw new ForbiddenError("Not authorized to modify this job");
    }

    job.isClosed = !job.isClosed;
    await this.jobRepository.save(job);

    return {
      message: job.isClosed
        ? "Job closed successfully"
        : "Job opened successfully",
      isClosed: job.isClosed,
    };
  }

  // Helper methods
  private async getSavedJobIds(userId: string): Promise<string[]> {
    const savedJobs = await this.savedJobRepository.find({
      where: { jobseekerId: userId },
      select: ["jobId"],
    });
    return savedJobs.map((s) => s.jobId);
  }

  private async getApplicationStatusMap(
    userId: string
  ): Promise<{ [key: string]: string }> {
    const applications = await this.applicationRepository.find({
      where: { applicantId: userId },
      select: ["jobId", "status"],
    });

    const statusMap: { [key: string]: string } = {};
    applications.forEach((app) => {
      statusMap[app.jobId] = app.status;
    });

    return statusMap;
  }
}

export const jobService = new JobService();
