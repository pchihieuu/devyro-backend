import { AppDataSource } from "../config/database.config";
import { Application, ApplicationStatus } from "../entities/Application.entity";
import { Job } from "../entities/Job.entity";
import { Company } from "../entities/Company.entity";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../utils/errors";
import { IsNull } from "typeorm";
import { notificationService } from "./notification.service";

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
    const job = await this.jobRepository.findOne({
      where: {
        id: jobId,
        deletedAt: IsNull(),
      },
      relations: ["company", "company.employer"],
    });

    if (!job) {
      throw new NotFoundError("Job not found or has been removed");
    }

    if (job.isClosed) {
      throw new BadRequestError("This job is no longer accepting applications");
    }

    const existing = await this.applicationRepository.findOne({
      where: {
        jobId,
        applicantId,
      },
    });

    if (existing) {
      throw new ConflictError("You have already applied to this job");
    }

    if (!resumeUrl) {
      throw new BadRequestError("Resume is required to apply for this job");
    }

    const application = this.applicationRepository.create({
      jobId,
      applicantId,
      resume: resumeUrl,
      status: ApplicationStatus.APPLIED,
    });

    const savedApplication = await this.applicationRepository.save(application);

    // Load applicant details
    const fullApplication = await this.applicationRepository.findOne({
      where: { id: savedApplication.id },
      relations: ["applicant"],
    });

    // Send notification to employer
    if (job.company && job.company.employerId) {
      await notificationService.notifyEmployerNewApplication(
        job.company.employerId,
        savedApplication.id,
        job.id,
        job.title,
        fullApplication?.applicant?.name || "A candidate"
      );
    }

    return savedApplication;
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
          isClosed: true,
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
    const job = await this.jobRepository.findOne({
      where: {
        id: jobId,
        deletedAt: IsNull(),
      },
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
          isClosed: true,
        },
        applicant: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          resume: true,
        },
      },
      order: { createdAt: "DESC" },
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
          isClosed: true,
          location: true,
          type: true,
          salaryMin: true,
          salaryMax: true,
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

    if (
      application.status === ApplicationStatus.ACCEPTED ||
      application.status === ApplicationStatus.REJECTED
    ) {
      throw new BadRequestError(
        `Cannot update application that is already ${application.status.toLowerCase()}`
      );
    }

    const oldStatus = application.status;
    application.status = status;
    await this.applicationRepository.save(application);

    // Send notification with jobId, only if status changed
    if (oldStatus !== status) {
      await notificationService.notifyApplicationStatusChanged(
        application.applicantId,
        application.id,
        application.job.id,
        application.job.title,
        application.job.company.name,
        status
      );
    }

    return {
      message: "Application status updated successfully",
      status,
    };
  }

  async withdrawApplication(
    applicationId: string,
    applicantId: string
  ): Promise<{ message: string }> {
    const application = await this.applicationRepository.findOne({
      where: {
        id: applicationId,
        applicantId,
      },
    });

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (
      application.status !== ApplicationStatus.APPLIED &&
      application.status !== ApplicationStatus.IN_REVIEW
    ) {
      throw new BadRequestError(
        "Cannot withdraw application that is already processed"
      );
    }

    await this.applicationRepository.softDelete(applicationId);

    return {
      message: "Application withdrawn successfully",
    };
  }
}

export const applicationService = new ApplicationService();