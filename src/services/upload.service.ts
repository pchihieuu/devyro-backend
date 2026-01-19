import { uploadToCloudinary } from "../utils/cloudinary.utils";
import { BadRequestError } from "../utils/errors";

interface UploadResult {
  url: string;
  publicId: string;
}

export class UploadService {
  private static readonly ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];
  private static readonly ALLOWED_RESUME_TYPE = "application/pdf";

  /**
   * Upload image to Cloudinary
   */
  async uploadImage(fileBuffer: Buffer, mimetype: string): Promise<UploadResult> {
    this.validateImageType(mimetype);

    const result = await uploadToCloudinary(
      fileBuffer,
      "job-portal/images",
      "image"
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  /**
   * Upload resume (PDF) to Cloudinary
   */
  async uploadResume(fileBuffer: Buffer, mimetype: string): Promise<UploadResult> {
    this.validateResumeType(mimetype);

    const result = await uploadToCloudinary(
      fileBuffer,
      "job-portal/resumes",
      "raw"
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  /**
   * Upload company logo to Cloudinary
   */
  async uploadCompanyLogo(fileBuffer: Buffer, mimetype: string): Promise<UploadResult> {
    this.validateImageType(mimetype);

    const result = await uploadToCloudinary(
      fileBuffer,
      "job-portal/company-logos",
      "image"
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  /**
   * Validate image file type
   */
  private validateImageType(mimetype: string): void {
    if (!UploadService.ALLOWED_IMAGE_TYPES.includes(mimetype)) {
      throw new BadRequestError(
        "Invalid file type. Only JPEG, JPG, and PNG are allowed"
      );
    }
  }

  /**
   * Validate resume file type
   */
  private validateResumeType(mimetype: string): void {
    if (mimetype !== UploadService.ALLOWED_RESUME_TYPE) {
      throw new BadRequestError("Only PDF files are allowed for resume");
    }
  }
}

export const uploadService = new UploadService();