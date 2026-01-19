import { AppDataSource } from "../config/database.config";
import { Application, ApplicationStatus } from "../entities/Application.entity";
import { Job } from "../entities/Job.entity";
import { Company } from "../entities/Company.entity";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../utils/errors";

export class ApplicationService {
  private applicationRepository = AppDataSource.getRepository(Application);
  private jobRepository = AppDataSource.getRepository(Job);
  private companyRepository = AppDataSource.getRepository(Company);

  /**
   * Apply to a job
   */
  async applyToJob(
    jobId: string,
    applicantId: string,
    resumeUrl: string
  ): Promise<Application> {
    // Check if already applied
    const existing = await this.applicationRepository.findOne({
      where: {
        jobId,
        applicantId,
      },
    });

    if (existing) {
      throw new ConflictError("Already applied to this job");
    }

    const application = this.applicationRepository.create({
      jobId,
      applicantId,
      resume: resumeUrl,
    });

    return await this.applicationRepository.save(application);
  }

  /**
   * Get applicant's applications
   */
  async getMyApplications(applicantId: string): Promise<Application[]> {
    return await this.applicationRepository.find({
      where: { applicantId },
      relations: ["job", "job.company"],
      select: {
        job: {
          id: true,
          title: true,
          location: true,
          type: true,
          companyId: true,
        },
      },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get applicants for a specific job (Employer only)
   */
  async getApplicantsForJob(
    jobId: string,
    employerId: string
  ): Promise<Application[]> {
    // Verify job exists
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ["company"],
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    if (job.company.employerId !== employerId) {
      throw new ForbiddenError(
        "Not authorized to view applicants for this job"
      );
    }

    return await this.applicationRepository.find({
      where: { jobId },
      relations: ["job", "applicant"],
      select: {
        job: {
          id: true,
          title: true,
          location: true,
          category: true,
          type: true,
        },
        applicant: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          resume: true,
        },
      },
    });
  }

  /**
   * Get application by ID
   */
  async getApplicationById(
    applicationId: string,
    userId: string
  ): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ["job", "job.company", "applicant"],
      select: {
        job: {
          id: true,
          title: true,
          companyId: true,
        },
        applicant: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          resume: true,
        },
      },
    });

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    const isApplicant = application.applicantId === userId;
    const isEmployer = application.job.company.employerId === userId;

    if (!isApplicant && !isEmployer) {
      throw new ForbiddenError("Not authorized to view this application");
    }

    return application;
  }

  /**
   * Update application status (Employer only)
   */
  async updateApplicationStatus(
    applicationId: string,
    employerId: string,
    status: ApplicationStatus
  ): Promise<{ message: string; status: ApplicationStatus }> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ["job", "job.company"],
    });

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (application.job.company.employerId !== employerId) {
      throw new ForbiddenError("Not authorized to update this application");
    }

    application.status = status;
    await this.applicationRepository.save(application);

    return {
      message: "Application status updated successfully",
      status,
    };
  }
}

export const applicationService = new ApplicationService();