import cloudinary from "../config/cloudinary.config";
import { config } from "../config/env.config";
import { withTimeout } from "./timeout.util";
import streamifier from "streamifier";
import { UploadApiResponse, UploadApiOptions } from "cloudinary";

/**
 * Upload file to Cloudinary
 */
export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder: string,
  resourceType: "image" | "raw" = "image"
): Promise<UploadApiResponse> => {
  const upload = new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadOptions: UploadApiOptions = {
      folder: folder,
      resource_type: resourceType,
      access_mode: "public",
      timeout: config.timeouts.cloudinaryMs, // timeout native của SDK
    };

    if (resourceType === "raw") {
      uploadOptions.format = "pdf";
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });

  // Chốt chặn cứng phía ngoài: SDK có thể không huỷ được stream đang treo.
  return withTimeout(upload, config.timeouts.cloudinaryMs, "Cloudinary upload");
};

/**
 * Delete file from Cloudinary
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "raw" = "image"
): Promise<any> => {
  try {
    const result = await withTimeout(
      cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      }),
      config.timeouts.cloudinaryMs,
      "Cloudinary delete"
    );
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Extract public_id from Cloudinary URL
 */
export const extractPublicId = (url: string): string | null => {
  if (!url) return null;

  const parts = url.split("/");
  const uploadIndex = parts.indexOf("upload");

  if (uploadIndex === -1) return null;

  const publicIdWithExtension = parts.slice(uploadIndex + 2).join("/");
  const lastDotIndex = publicIdWithExtension.lastIndexOf(".");
  const publicId =
    lastDotIndex !== -1
      ? publicIdWithExtension.substring(0, lastDotIndex)
      : publicIdWithExtension;

  return publicId;
};
