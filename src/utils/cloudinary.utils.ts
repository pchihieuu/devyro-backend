import cloudinary from "../config/cloudinary.config";
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
  return new Promise((resolve, reject) => {
    const uploadOptions: UploadApiOptions = {
      folder: folder,
      resource_type: resourceType,
      access_mode: "public",
    };

    if (resourceType === "image") {
      uploadOptions.transformation = [
        { width: 1000, height: 1000, crop: "limit" },
      ];
    }

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
};

/**
 * Delete file from Cloudinary
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "raw" = "image"
): Promise<any> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
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
