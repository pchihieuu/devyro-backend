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
import { geminiAIMatchingService } from "./geminiaimatching.service";
import { cleanResumeText, extractPDFText } from "../utils/pdfextractor.utils";

export class ApplicationService {
  private applicationRepository = AppDataSource.getRepository(Application);
  private jobRepository = AppDataSource.getRepository(Job);
  private companyRepository = AppDataSource.getRepository(Company);

  /**
   * Apply to a job with AI matching analysis
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

    // Create application
    const application = this.applicationRepository.create({
      jobId,
      applicantId,
      resume: resumeUrl,
      status: ApplicationStatus.APPLIED,
    });

    const savedApplication = await this.applicationRepository.save(application);

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
   * Perform AI matching analysis (async) - USING GEMINI
   */
  private async performAIAnalysis(
    applicationId: string,
    resumeUrl: string,
    job: Job
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

      // Update application with analysis results
      await this.applicationRepository.update(applicationId, {
        aiMatchingScore: analysis.score,
        aiMatchingAnalysis: analysis,
        aiAnalyzedAt: new Date(),
      });

      console.log(
        `Gemini AI analysis completed for application ${applicationId}: Score ${analysis.score}`
      );
    } catch (error) {
      console.error("Gemini AI analysis error:", error);
      await this.applicationRepository.update(applicationId, {
        aiMatchingScore: 0,
        aiMatchingAnalysis: {
          score: 0,
          strengths: [],
          weaknesses: [],
          recommendations: ["AI analysis failed - manual review required"],
          skillsMatch: {
            matched: [],
            missing: [],
            matchPercentage: 0,
          },
          experienceMatch: {
            summary: "Analysis unavailable",
            isMatch: false,
          },
          educationMatch: {
            summary: "Analysis unavailable",
            isMatch: false,
          },
          overallAssessment:
            "AI analysis encountered an error. Please review manually.",
        },
        aiAnalyzedAt: new Date(),
      });
    }
  }

  /**
   * Manually trigger AI analysis for existing application
   */
  async triggerAIAnalysis(
    applicationId: string,
    employerId: string
  ): Promise<{ message: string; analysis?: any }> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ["job", "job.company"],
    });

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (application.job.company.employerId !== employerId) {
      throw new ForbiddenError("Not authorized to analyze this application");
    }

    if (!application.resume) {
      throw new BadRequestError("No resume found for this application");
    }

    // Perform analysis
    await this.performAIAnalysis(
      application.id,
      application.resume,
      application.job
    );

    // Fetch updated application
    const updated = await this.applicationRepository.findOne({
      where: { id: applicationId },
      select: ["aiMatchingScore", "aiMatchingAnalysis", "aiAnalyzedAt"],
    });

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
   * Get applicants for a specific job (Employer only) - with AI scores
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
      order: {
        aiMatchingScore: "DESC",
        createdAt: "DESC",
      },
    });
  }

  /**
   * Get application by ID - with AI analysis
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
