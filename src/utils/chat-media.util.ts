import cloudinary from "../config/cloudinary.config";
import { config } from "../config/env.config";
import { BadRequestError } from "../utils/errors";
import { withTimeout } from "./timeout.util";

// Dùng chung instance đã cấu hình ở config/cloudinary.config — file này từng tự
// gọi cloudinary.config() bằng process.env lần thứ 2 (2 nơi cấu hình cùng 1 SDK
// singleton dễ lệch nhau và ghi đè lẫn nhau).

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

  const upload = new Promise<UploadedMedia>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: resourceType,
          folder,
          use_filename: true,
          unique_filename: true,
          timeout: config.timeouts.cloudinaryMs,
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

  return withTimeout(upload, config.timeouts.cloudinaryMs, "Cloudinary upload");
}

export async function deleteChatMedia(
  publicId: string,
  resourceType: "image" | "raw" | "video" = "image"
): Promise<void> {
  try {
    await withTimeout(
      cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      }),
      config.timeouts.cloudinaryMs,
      "Cloudinary delete"
    );
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}