import { v2 as cloudinary } from "cloudinary";
import { BadRequestError } from "../utils/errors";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface UploadedMedia {
  url: string;
  publicId: string;
  type: "image" | "file" | "video";
  mimeType: string;
  size: number;
  originalName: string;
}

export async function uploadChatMedia(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  fileSize: number
): Promise<UploadedMedia> {
  if (fileSize > MAX_FILE_SIZE) {
    throw new BadRequestError("File size exceeds 50MB limit");
  }

  let resourceType: "image" | "raw" | "video";
  let folder: string;
  let mediaType: "image" | "file" | "video";

  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    resourceType = "image";
    folder = "chat/images";
    mediaType = "image";
  } else if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    resourceType = "video";
    folder = "chat/videos";
    mediaType = "video";
  } else if (ALLOWED_FILE_TYPES.includes(mimeType)) {
    resourceType = "raw";
    folder = "chat/files";
    mediaType = "file";
  } else {
    throw new BadRequestError(`Unsupported file type: ${mimeType}`);
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: resourceType,
          folder,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result) {
            return reject(new Error("Cloudinary upload failed"));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            type: mediaType,
            mimeType,
            size: fileSize,
            originalName,
          });
        }
      )
      .end(buffer);
  });
}

export async function deleteChatMedia(
  publicId: string,
  resourceType: "image" | "raw" | "video" = "image"
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}