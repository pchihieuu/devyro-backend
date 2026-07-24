import { Application, ApplicationStatus } from "../entities/Application.entity";
import { Job } from "../entities/Job.entity";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../utils/errors";
import { notificationService } from "./notification.service";
import { geminiAIMatchingService } from "./geminiaimatching.service";
import { cleanResumeText, extractPDFText } from "../utils/pdfextractor.utils";
import { jobRepository, JobRepository } from "../repositories/job.repository";
import {
  applicationRepository,
  ApplicationRepository,
  MyApplicationsQuery,
} from "../repositories/application.repository";

export class ApplicationService {
  constructor(
    private readonly applicationRepo: ApplicationRepository = applicationRepository,
    private readonly jobRepo: JobRepository = jobRepository
  ) {}

  /**
   * Apply to a job with AI matching analysis.
   * Supports re-applying after withdrawal (upsert existing WITHDRAWN record).
   */
  async applyToJob(
    jobId: string,
    applicantId: string,
    resumeUrl: string
  ): Promise<Application> {
    const job = await this.jobRepo.findActiveByIdWithCompany(jobId);

    if (!job) {
      throw new NotFoundError("Job not found or has been removed");
    }

    if (job.isClosed) {
      throw new BadRequestError("This job is no longer accepting applications");
    }

    if (!resumeUrl) {
      throw new BadRequestError("Resume is required to apply for this job");
    }

    const existing = await this.applicationRepo.findByJobAndApplicant(
      jobId,
      applicantId
    );

    let savedApplication: Application;

    if (existing) {
      if (existing.status !== ApplicationStatus.WITHDRAWN) {
        throw new ConflictError("You have already applied to this job");
      }

      existing.status = ApplicationStatus.APPLIED;
      existing.resume = resumeUrl;
      existing.aiMatchingScore = 0;
      existing.aiMatchingAnalysis = null;
      existing.aiAnalyzedAt = null;

      savedApplication = await this.applicationRepo.save(existing);
    } else {
      const application = this.applicationRepo.create({
        jobId,
        applicantId,
        resume: resumeUrl,
        status: ApplicationStatus.APPLIED,
      });

      savedApplication = await this.applicationRepo.save(application);
    }

    // Perform AI matching analysis asynchronously (don't block the response)
    this.performAIAnalysis(savedApplication.id, resumeUrl, job).catch(
      (error) => {
        console.error(
          "AI Analysis failed for application:",
          savedApplication.id,
          error
        );
      }
    );

    // Load applicant details for notification
    const fullApplication = await this.applicationRepo.findByIdWithApplicant(
      savedApplication.id
    );

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
   * Perform AI matching analysis (async) - USING GEMINI
   */
  private async performAIAnalysis(
    applicationId: string,
    resumeUrl: string,
    job: Job,
    throwOnError = false
  ): Promise<void> {
    try {
      let resumeText: string;
      try {
        resumeText = await extractPDFText(resumeUrl);
        resumeText = cleanResumeText(resumeText);
      } catch (pdfError) {
        console.error("PDF extraction failed, using URL only:", pdfError);
        resumeText = `Resume URL: ${resumeUrl}`;
      }

      const analysis = await geminiAIMatchingService.analyzeResumeJobMatch(
        { url: resumeUrl, text: resumeText },
        job
      );

      await this.applicationRepo.update(applicationId, {
        aiMatchingScore: analysis.score,
        aiMatchingAnalysis: analysis,
        aiAnalyzedAt: new Date(),
      });

      console.log(
        `Gemini AI analysis completed for application ${applicationId}: Score ${analysis.score}`
      );
    } catch (error) {
      console.error("Gemini AI analysis error:", error);

      if (throwOnError) {
        throw error;
      }

      // Silent fallback — only reached when called async from applyToJob
      await this.applicationRepo.update(applicationId, {
        aiMatchingScore: 0,
        aiMatchingAnalysis: {
          score: 0,
          strengths: [],
          weaknesses: [],
          recommendations: ["AI analysis failed - manual review required"],
          skillsMatch: { matched: [], missing: [], matchPercentage: 0 },
          experienceMatch: { summary: "Analysis unavailable", isMatch: false },
          educationMatch: { summary: "Analysis unavailable", isMatch: false },
          overallAssessment:
            "AI analysis encountered an error. Please review manually.",
        },
        aiAnalyzedAt: new Date(),
      });
    }
  }

  /**
   * Manually trigger AI analysis for an existing application (Employer only)
   */
  async triggerAIAnalysis(
    applicationId: string,
    employerId: string
  ): Promise<{ message: string; analysis?: any }> {
    const application =
      await this.applicationRepo.findByIdWithJobAndCompany(applicationId);

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (application.job.company.employerId !== employerId) {
      throw new ForbiddenError("Not authorized to analyze this application");
    }

    if (!application.resume) {
      throw new BadRequestError("No resume found for this application");
    }

    await this.performAIAnalysis(
      application.id,
      application.resume,
      application.job,
      true
    );

    const updated = await this.applicationRepo.findAiFieldsById(applicationId);

    return {
      message: "Gemini AI analysis completed successfully",
      analysis: updated
        ? {
            score: updated.aiMatchingScore,
            details: updated.aiMatchingAnalysis,
            analyzedAt: updated.aiAnalyzedAt,
          }
        : undefined,
    };
  }

  /**
   * Get applicant's own applications.
   * Excludes WITHDRAWN by default; pass status=Withdrawn to see them explicitly.
   */
  async getMyApplications(
    applicantId: string,
    pagination: MyApplicationsQuery
  ): Promise<{
    applications: Application[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [applications, total] =
      await this.applicationRepo.findAndCountByApplicant(
        applicantId,
        pagination
      );

    return {
      applications,
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  /**
   * Get all applicants for a specific job (Employer only), sorted by AI score.
   * Excludes withdrawn applications.
   */
  async getApplicantsForJob(
    jobId: string,
    employerId: string
  ): Promise<Application[]> {
    const job = await this.jobRepo.findActiveByIdWithCompany(jobId);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    if (job.company.employerId !== employerId) {
      throw new ForbiddenError(
        "Not authorized to view applicants for this job"
      );
    }

    return this.applicationRepo.findByJobExcludingWithdrawn(jobId);
  }

  /**
   * Get a single application by ID.
   * Accessible by the applicant themselves or the employer who posted the job.
   */
  async getApplicationById(
    applicationId: string,
    userId: string
  ): Promise<Application> {
    const application =
      await this.applicationRepo.findByIdWithJobAndApplicant(applicationId);

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
   * Update application status (Employer only).
   * Cannot update ACCEPTED, REJECTED, or WITHDRAWN applications.
   */
  async updateApplicationStatus(
    applicationId: string,
    employerId: string,
    status: ApplicationStatus
  ): Promise<{ message: string; status: ApplicationStatus }> {
    const application =
      await this.applicationRepo.findByIdWithJobAndCompany(applicationId);

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (application.job.company.employerId !== employerId) {
      throw new ForbiddenError("Not authorized to update this application");
    }

    const lockedStatuses = [
      ApplicationStatus.ACCEPTED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ];

    if (lockedStatuses.includes(application.status)) {
      throw new BadRequestError(
        `Cannot update application that is already ${application.status.toLowerCase()}`
      );
    }

    const oldStatus = application.status;
    application.status = status;
    await this.applicationRepo.save(application);

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

    return { message: "Application status updated successfully", status };
  }

  /**
   * Withdraw an application (Job seeker only).
   * Only APPLIED or IN_REVIEW applications can be withdrawn.
   */
  async withdrawApplication(
    applicationId: string,
    applicantId: string
  ): Promise<{ message: string }> {
    const application = await this.applicationRepo.findByIdAndApplicant(
      applicationId,
      applicantId
    );

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

    application.status = ApplicationStatus.WITHDRAWN;
    await this.applicationRepo.save(application);

    return { message: "Application withdrawn successfully" };
  }
}

export const applicationService = new ApplicationService();
